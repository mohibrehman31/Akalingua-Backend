import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import { enqueueJob } from "../../jobs/queue";
import * as studentService from "../students/students.service";
import * as notificationsService from "../notifications/notifications.service";
import * as jobPostsService from "./jobposts.service";

const createSchema = z
  .object({
    post_type: z.enum(["broadcast", "individual"]),
    target_language_code: z.string().min(2).max(10),
    target_language_name: z.string().min(1).max(100),
    dialect_preference: z.string().max(100).nullish(),
    current_level: z.enum(["newbie", "elementary", "intermediate", "advanced"]),
    skill_gaps: z.array(z.string()).nullish(),
    objective: z.enum([
      "relocation",
      "business",
      "exam_prep",
      "academic",
      "personal",
    ]),
    exam_target: z.string().max(100).nullish(),
    frequency: z.enum(["casual", "standard", "intensive"]),
    duration: z.enum(["sprint", "season", "marathon"]),
    delivery_mode: z.enum(["online", "in_person", "flexible"]),
    location_postcode: z.string().max(20).nullish(),
    location_district: z.string().max(100).nullish(),
    native_speaker_required: z.boolean().nullish().default(false),
    budget_min: z.number().nonnegative().nullish(),
    budget_max: z.number().nonnegative().nullish(),
    additional_notes: z.string().max(2000).nullish(),
    shortlist_capacity: z.number().int().min(1).max(50).nullish(),
  })
  .strip();

const closeSchema = z.object({ reason: z.string().max(500).optional() });
const shortlistSchema = z.object({ quote_id: z.string().min(1) });

/** Resolve the signed-in student's profile, or null. */
const requireStudent = async (req: AuthRequest) =>
  studentService.getStudentByUserId(req.user!.id);

export const create = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const student = await requireStudent(req);
  if (!student)
    return res.status(404).json({ message: "Student profile not found" });

  const post = await jobPostsService.createJobPost(student.id, parsed.data);

  // Accelerator subscribers see leads immediately; everyone else after 10 min.
  await enqueueJob("NOTIFY_ACCELERATOR_FEED", {
    job_post_id: post.id,
    stage: "accelerator",
  });
  await enqueueJob(
    "NOTIFY_ACCELERATOR_FEED",
    { job_post_id: post.id, stage: "standard" },
    600,
  );

  res.status(201).json(post);
};

export const listMine = async (req: AuthRequest, res: Response) => {
  const student = await requireStudent(req);
  if (!student)
    return res.status(404).json({ message: "Student profile not found" });

  const posts = await jobPostsService.listMine(student.id);
  res.json(posts); // bare array, newest-first
};

/** Loads a post and enforces owner-only access; returns null + sends 404 otherwise. */
const loadOwnedPost = async (req: AuthRequest, res: Response) => {
  const student = await requireStudent(req);
  if (!student) {
    res.status(404).json({ message: "Student profile not found" });
    return null;
  }
  const post = await jobPostsService.getById(String(req.params.id));
  // Cross-tenant access is masked as not-found (don't leak existence).
  if (!post || post.student_id !== student.id) {
    res.status(404).json({ message: "Request not found" });
    return null;
  }
  return post;
};

export const getOne = async (req: AuthRequest, res: Response) => {
  const post = await loadOwnedPost(req, res);
  if (!post) return;

  const quotes = await jobPostsService.getAnonymizedQuotes(post.id);
  res.json({ ...post, quotes });
};

export const cancel = async (req: AuthRequest, res: Response) => {
  const post = await loadOwnedPost(req, res);
  if (!post) return;

  await jobPostsService.cancel(post.id);
  res.status(204).send();
};

export const close = async (req: AuthRequest, res: Response) => {
  const parsed = closeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const post = await loadOwnedPost(req, res);
  if (!post) return;

  if (post.status !== "open" && post.status !== "shortlisting")
    return res.status(400).json({ message: "Only open requests can be closed" });

  if (!jobPostsService.hasBeenOpen24h(post))
    return res
      .status(400)
      .json({ message: "Jobs must remain open for at least 24 hours" });

  const tutorUserIds =
    await jobPostsService.getPendingQuoteTutorUserIds(post.id);
  await jobPostsService.close(post.id);

  await Promise.all(
    tutorUserIds.map((user_id) =>
      notificationsService.createNotification({
        user_id,
        type: "job_closed",
        title: "A request you quoted on was closed",
        metadata: { job_post_id: post.id },
      }),
    ),
  );

  res.status(204).send();
};

export const repost = async (req: AuthRequest, res: Response) => {
  const post = await loadOwnedPost(req, res);
  if (!post) return;

  const updated = await jobPostsService.repost(post.id);
  res.json(updated);
};

// --- Shortlist -------------------------------------------------------------

export const getShortlist = async (req: AuthRequest, res: Response) => {
  const post = await loadOwnedPost(req, res);
  if (!post) return;

  const slots = await jobPostsService.getActiveShortlist(post.id);
  res.json(slots); // bare array
};

export const addToShortlist = async (req: AuthRequest, res: Response) => {
  const parsed = shortlistSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const post = await loadOwnedPost(req, res);
  if (!post) return;

  const result = await jobPostsService.shortlistQuote(post, parsed.data.quote_id);
  if (!result.ok)
    return res.status(result.status).json({ message: result.message });

  const tutorUserId = await jobPostsService.getTutorUserId(result.tutor_id);
  if (tutorUserId) {
    await notificationsService.createNotification({
      user_id: tutorUserId,
      type: "shortlisted",
      title: "You've been shortlisted",
      metadata: { quote_id: parsed.data.quote_id, job_post_id: post.id },
    });
  }

  res.status(204).send();
};

export const removeFromShortlist = async (req: AuthRequest, res: Response) => {
  const post = await loadOwnedPost(req, res);
  if (!post) return;

  const removed = await jobPostsService.removeShortlist(
    post.id,
    String(req.params.quoteId),
  );
  if (!removed)
    return res.status(404).json({ message: "Shortlist entry not found" });

  res.status(204).send();
};
