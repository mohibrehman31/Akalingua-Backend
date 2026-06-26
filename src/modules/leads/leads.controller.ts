import { Response } from "express";
import { z } from "zod";
import db from "../../config/database";
import { AuthRequest } from "../../middleware/auth.middleware";
import { enqueueJob } from "../../jobs/queue";
import * as leadService from "./leads.service";
import * as studentService from "../students/students.service";
import * as tutorService from "../tutors/tutors.service";

const signalSchema = z.object({
  job_post_id: z.string().uuid(),
});

const feedSchema = z.object({
  language: z.string().optional(),
  delivery: z.string().optional(),
  level: z.string().optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /leads — paginated anonymized lead feed (API.md §6).
export const feed = async (req: AuthRequest, res: Response) => {
  const parsed = feedSchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid filters", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const { page, limit, ...filters } = parsed.data;
  const result = await leadService.getLeadFeed(
    tutor.id,
    tutor.is_accelerator_subscriber,
    filters,
    page,
    limit,
  );
  res.json(result);
};

// POST /leads/:jobPostId/signal — lightweight intent ping → 204 (API.md §6).
export const signalByParam = async (req: AuthRequest, res: Response) => {
  const jobPostId = String(req.params.jobPostId);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const post = await studentService.getJobPostById(jobPostId);
  if (!post) return res.status(404).json({ message: "Request not found" });

  const existing = await leadService.findSignal(post.id, tutor.id);
  if (!existing) await leadService.createSignal(post.id, tutor.id);
  res.status(204).send();
};

const quoteSchema = z.object({
  job_post_id: z.string().uuid(),
  proposed_rate: z.number().min(1),
  rate_type: z.enum(["hourly", "package"]).default("hourly"),
  package_sessions: z.number().int().positive().optional(),
  cover_message: z.string().min(20).max(1000),
  template_used: z.boolean().default(false),
});

const shortlistSchema = z.object({
  quote_id: z.string().uuid(),
});

export const signalInterest = async (req: AuthRequest, res: Response) => {
  const parsed = signalSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ error: "Tutor profile not found" });

  const post = await studentService.getJobPostById(parsed.data.job_post_id);
  if (!post) return res.status(404).json({ error: "Resource not found" });
  if (post.status !== "open" && post.status !== "shortlisting") {
    return res
      .status(400)
      .json({ error: "This job post is no longer accepting signals" });
  }

  const existing = await leadService.findSignal(post.id, tutor.id);
  if (existing) {
    return res.json({ signalled: false, reason: "Already signalled" });
  }

  await leadService.createSignal(post.id, tutor.id);
  res.json({ signalled: true });
};

export const submitQuote = async (req: AuthRequest, res: Response) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.rate_type === "package" && !parsed.data.package_sessions) {
    return res.status(400).json({
      error: "package_sessions is required when rate_type is package",
    });
  }

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ error: "Tutor profile not found" });

  const post = await studentService.getJobPostById(parsed.data.job_post_id);
  if (!post) return res.status(404).json({ error: "Resource not found" });

  if (post.status !== "open" && post.status !== "shortlisting") {
    return res
      .status(400)
      .json({ error: "This job post is no longer accepting quotes" });
  }
  if (post.expires_at && new Date(post.expires_at) < new Date()) {
    return res.status(400).json({ error: "This job post has expired" });
  }

  const existingQuote = await leadService.getQuoteByJobAndTutor(
    post.id,
    tutor.id,
  );
  if (existingQuote) {
    return res
      .status(409)
      .json({ error: "You have already submitted a quote for this job post" });
  }

  const platformFeePct = post.post_type === "broadcast" ? 7.5 : 10.0;
  const shortlistFull = post.shortlist_count >= post.shortlist_capacity;

  const { quote, thread, queued } = await leadService.createQuoteWithThread(
    tutor.id,
    post.student_id,
    parsed.data,
    platformFeePct,
    shortlistFull,
  );

  const studentUser = await db("student_profiles as sp")
    .innerJoin("users as u", "u.id", "sp.user_id")
    .where("sp.id", post.student_id)
    .select("u.id as user_id")
    .first();

  if (studentUser) {
    await enqueueJob("SEND_NOTIFICATION", {
      user_id: studentUser.user_id,
      type: "quote_received",
      title: "New quote received",
      body: "A tutor has sent a quote on your job post.",
      metadata: { job_post_id: post.id, quote_id: quote.id },
    });
  }

  if (queued) {
    return res.status(201).json({
      quote,
      chat_thread_id: thread.id,
      shortlist_full: true,
      queued: true,
      message:
        "The shortlist is full. Your quote was recorded and you were added to the interest queue.",
    });
  }

  res.status(201).json({ quote, chat_thread_id: thread.id });
};

export const myQuotes = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ error: "Tutor profile not found" });

  const status = req.query.status as string | undefined;
  const allowed = [
    "pending",
    "shortlisted",
    "accepted",
    "rejected",
    "expired",
    "archived",
  ];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  const quotes = await leadService.getMyQuotes(tutor.id, status);
  res.json({ data: quotes });
};

export const shortlist = async (req: AuthRequest, res: Response) => {
  const parsed = shortlistSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const student = await studentService.getStudentByUserId(req.user!.id);
  if (!student)
    return res.status(404).json({ error: "Student profile not found" });

  let result;
  try {
    result = await leadService.shortlistQuote(student.id, parsed.data.quote_id);
  } catch (e: any) {
    switch (e.message) {
      case "QUOTE_NOT_FOUND":
        return res.status(404).json({ error: "Resource not found" });
      case "FORBIDDEN":
        return res.status(403).json({ error: "Insufficient permissions" });
      case "QUOTE_NOT_PENDING":
        return res
          .status(400)
          .json({ error: "Quote is no longer available to shortlist" });
      case "SHORTLIST_FULL":
        return res.status(400).json({
          error: "Your shortlist is full. Remove a tutor to add a new one.",
          shortlist_capacity: e.capacity,
        });
      case "JOB_NOT_FOUND":
        return res.status(404).json({ error: "Resource not found" });
      default:
        throw e;
    }
  }

  const tutorRow = await db("tutor_profiles as t")
    .innerJoin("users as u", "u.id", "t.user_id")
    .where("t.id", result.quote.tutor_id)
    .select("u.id as user_id", "t.display_name", "t.first_name")
    .first();

  if (tutorRow) {
    await enqueueJob("SEND_NOTIFICATION", {
      user_id: tutorRow.user_id,
      type: "shortlisted",
      title: "You've been shortlisted",
      body: `You've been shortlisted! Pay €${result.quote.lead_fee_amount} to unlock this student's contact details.`,
      metadata: {
        quote_id: result.quote.id,
        lead_fee_amount: result.quote.lead_fee_amount,
      },
    });

    await enqueueJob("SEND_EMAIL", {
      to_user_id: tutorRow.user_id,
      template: "SHORTLISTED",
      variables: {
        tutor_name: tutorRow.display_name || tutorRow.first_name,
        student_first_name: student.first_name,
        lead_fee_amount: result.quote.lead_fee_amount,
      },
    });
  }

  res.json({ quote: result.quote, slot: result.slot });
};

export const removeShortlist = async (req: AuthRequest, res: Response) => {
  const quoteId = String(req.params.quoteId);
  const student = await studentService.getStudentByUserId(req.user!.id);
  if (!student)
    return res.status(404).json({ error: "Student profile not found" });

  let result;
  try {
    result = await leadService.removeFromShortlist(student.id, quoteId);
  } catch (e: any) {
    switch (e.message) {
      case "SLOT_NOT_FOUND":
      case "QUOTE_NOT_FOUND":
        return res.status(404).json({ error: "Resource not found" });
      case "FORBIDDEN":
        return res.status(403).json({ error: "Insufficient permissions" });
      case "LEAD_FEE_ALREADY_PAID":
        return res.status(400).json({
          error:
            "Cannot remove a shortlisted tutor whose lead fee has already been paid",
        });
      default:
        throw e;
    }
  }

  if (result.notifiedTutorId) {
    const tutorUser = await db("tutor_profiles as t")
      .innerJoin("users as u", "u.id", "t.user_id")
      .where("t.id", result.notifiedTutorId)
      .select("u.id as user_id")
      .first();
    if (tutorUser) {
      await enqueueJob("SEND_NOTIFICATION", {
        user_id: tutorUser.user_id,
        type: "slot_opened",
        title: "A shortlist slot just opened",
        body: "A shortlist slot just opened for a job you're interested in. Submit your proposal now.",
      });
    }
  }

  res.json({ message: "Removed from shortlist" });
};

export const getShortlist = async (req: AuthRequest, res: Response) => {
  const jobPostId = String(req.params.jobPostId);
  const student = await studentService.getStudentByUserId(req.user!.id);
  if (!student)
    return res.status(404).json({ error: "Student profile not found" });

  const post = await studentService.getJobPostById(jobPostId);
  if (!post) return res.status(404).json({ error: "Resource not found" });
  if (post.student_id !== student.id)
    return res.status(403).json({ error: "Insufficient permissions" });

  const slots = await leadService.getShortlistForJob(jobPostId);
  res.json({
    data: slots,
    shortlist_count: post.shortlist_count,
    shortlist_capacity: post.shortlist_capacity,
    slots_remaining: Math.max(0, post.shortlist_capacity - post.shortlist_count),
  });
};
