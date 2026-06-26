import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as quotesService from "./quotes.service";
import * as tutorService from "../tutors/tutors.service";
import * as studentService from "../students/students.service";
import * as notificationsService from "../notifications/notifications.service";
import { QuoteStatus } from "./quotes.types";

const QUOTE_STATUSES: QuoteStatus[] = [
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "expired",
  "archived",
];

const createSchema = z.object({
  job_post_id: z.string().uuid(),
  proposed_rate: z.number().positive(),
  rate_type: z.enum(["hourly", "package"]).default("hourly"),
  package_sessions: z.number().int().positive().optional(),
  cover_message: z.string().min(1).max(2000),
});

const templateSchema = z.object({
  name: z.string().min(1).max(255),
  cover_message: z.string().min(1).max(2000),
  proposed_rate: z.number().positive().optional(),
  rate_type: z.enum(["hourly", "package"]).optional(),
});

export const create = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid quote", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const post = await studentService.getJobPostById(parsed.data.job_post_id);
  if (!post) return res.status(404).json({ message: "Request not found" });
  if (post.status !== "open" && post.status !== "shortlisting")
    return res.status(400).json({ message: "This request is no longer accepting quotes" });

  const existing = await quotesService.getExistingQuote(post.id, tutor.id);
  if (existing)
    return res.status(409).json({ message: "You already quoted on this request" });

  const { quote, studentUserId } = await quotesService.createQuote(tutor.id, {
    job_post_id: post.id,
    student_id: post.student_id,
    proposed_rate: parsed.data.proposed_rate,
    rate_type: parsed.data.rate_type,
    package_sessions: parsed.data.package_sessions ?? null,
    cover_message: parsed.data.cover_message,
  });

  if (studentUserId) {
    await notificationsService.createNotification({
      user_id: studentUserId,
      type: "new_quote",
      title: "New quote on your request",
      body: "A tutor sent you a quote.",
      metadata: { quote_id: quote.id, job_post_id: post.id },
    });
  }

  res.status(201).json(quote);
};

export const mine = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const status = req.query.status as QuoteStatus | undefined;
  if (status && !QUOTE_STATUSES.includes(status))
    return res.status(400).json({ message: "Invalid status filter" });

  const quotes = await quotesService.getMyQuotes(tutor.id, status);
  res.json(quotes);
};

export const listTemplates = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });
  res.json(await quotesService.getTemplates(tutor.id));
};

export const createTemplate = async (req: AuthRequest, res: Response) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid template", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const template = await quotesService.createTemplate(tutor.id, parsed.data);
  res.status(201).json(template);
};
