import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as studentService from "./students.service";
import * as tutorService from "../tutors/tutors.service";

const SENSITIVE_FIELDS = [
  "password_hash",
  "otp_code",
  "otp_expires_at",
  "otp_attempts",
];

const stripSensitive = <T extends Record<string, any>>(row: T): T => {
  const copy: any = { ...row };
  for (const f of SENSITIVE_FIELDS) delete copy[f];
  return copy;
};

const profileUpdateSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(100).nullish(),
  avatar_url: z.string().url().nullish(),
  location_postcode: z.string().max(20).nullish(),
  location_district: z.string().max(100).nullish(),
  location_country: z.string().max(100).nullish(),
});

const avatarUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100),
});

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  // Auto-create the profile if missing for a valid student user.
  const student = await studentService.getOrCreateStudentProfile(req.user!.id);
  res.json(stripSensitive(student));
};

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const student = await studentService.getOrCreateStudentProfile(req.user!.id);
  const updated = await studentService.updateStudentProfile(
    student.id,
    parsed.data,
  );
  res.json(stripSensitive(updated));
};

export const getAvatarUploadUrl = async (req: AuthRequest, res: Response) => {
  const parsed = avatarUploadUrlSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const student = await studentService.getOrCreateStudentProfile(req.user!.id);
  const result = await tutorService.generateAvatarUploadUrl(
    "students",
    student.id,
    parsed.data.filename,
    parsed.data.content_type,
  );
  res.json(result);
};

// Tutor-facing lead feed (kept here; tutor dashboard surface).
export const getFeed = async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const isAccelerator =
    tutor.is_accelerator_subscriber &&
    (!tutor.accelerator_expires_at ||
      new Date(tutor.accelerator_expires_at) > new Date());

  const feed = await studentService.getFeedForTutor(
    tutor.id,
    isAccelerator,
    page,
    limit,
  );
  res.json(feed);
};
