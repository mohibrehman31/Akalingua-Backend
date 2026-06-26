import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as tutorService from "./tutors.service";

const SENSITIVE_FIELDS = [
  "password_hash",
  "otp_code",
  "otp_expires_at",
  "otp_attempts",
  "stripe_customer_id",
  "stripe_subscription_id",
];

const stripSensitive = <T extends Record<string, any>>(row: T): T => {
  const copy: any = { ...row };
  for (const f of SENSITIVE_FIELDS) delete copy[f];
  return copy;
};

const boolStr = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

const profileUpdateSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().optional(),
  tagline: z.string().max(255).optional(),
  hourly_rate_min: z.number().positive().optional(),
  hourly_rate_max: z.number().positive().optional(),
  years_of_experience: z.number().int().min(0).optional(),
  specialisations: z.array(z.string()).optional(),
  student_age_groups: z.array(z.string()).optional(),
  location_district: z.string().max(100).optional(),
  location_country: z.string().max(100).optional(),
  teaches_online: z.boolean().optional(),
  teaches_in_person: z.boolean().optional(),
});

const addLanguageSchema = z.object({
  language_code: z.string().min(2).max(10),
  language_name: z.string().min(1).max(100),
  dialect: z.string().max(100).optional(),
  status: z.enum(["L1", "L2"]),
  is_primary: z.boolean().optional().default(false),
});

const createCredentialSchema = z.object({
  credential_type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  institution: z.string().max(255).optional(),
  issued_year: z.number().int().min(1900).max(2100).optional(),
  file_url: z.string().url(),
});

const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100),
});

const searchSchema = z.object({
  language: z.string().optional(),
  level: z.string().optional(),
  minRate: z.coerce.number().optional(),
  maxRate: z.coerce.number().optional(),
  online: boolStr,
  inPerson: boolStr,
  rating: z.coerce.number().optional(),
  q: z.string().optional(),
  sort: z.enum(["rating", "newest", "rate_asc", "rate_desc"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });
  res.json(tutorService.serializeTutor(stripSensitive(tutor)));
};

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid profile", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const updated = await tutorService.updateTutorProfile(tutor.id, parsed.data);
  const profile_completion_pct = await tutorService.recalculateAndSaveCompletion(tutor.id);
  res.json(tutorService.serializeTutor({ ...stripSensitive(updated), profile_completion_pct }));
};

export const goLive = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const pct = await tutorService.recalculateAndSaveCompletion(tutor.id);
  if (pct < 40) {
    return res.status(400).json({
      message: `Your profile must be at least 40% complete to go live (currently ${pct}%)`,
      profile_completion_pct: pct,
    });
  }

  const updated = await tutorService.setLive(tutor.id, true);
  res.json(tutorService.serializeTutor(stripSensitive(updated)));
};

export const goOffline = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const updated = await tutorService.setLive(tutor.id, false);
  res.json(tutorService.serializeTutor(stripSensitive(updated)));
};

export const listLanguages = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });
  res.json(await tutorService.getTutorLanguages(tutor.id));
};

export const addLanguage = async (req: AuthRequest, res: Response) => {
  const parsed = addLanguageSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid language", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const dup = await tutorService.findDuplicateLanguage(tutor.id, parsed.data.language_code);
  if (dup) return res.status(409).json({ message: "Language already added to profile" });

  const row = await tutorService.addLanguage(tutor.id, parsed.data);
  await tutorService.recalculateAndSaveCompletion(tutor.id);
  res.status(201).json(row);
};

export const deleteLanguage = async (req: AuthRequest, res: Response) => {
  const languageId = String(req.params.id);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const lang = await tutorService.getLanguageById(languageId);
  // Cross-tenant / missing → 404 (don't leak existence, §12).
  if (!lang || lang.tutor_id !== tutor.id)
    return res.status(404).json({ message: "Language not found" });

  await tutorService.deleteLanguage(languageId);
  await tutorService.recalculateAndSaveCompletion(tutor.id);
  res.status(204).send();
};

export const listCredentials = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });
  res.json(await tutorService.getTutorCredentials(tutor.id));
};

export const createCredential = async (req: AuthRequest, res: Response) => {
  const parsed = createCredentialSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid credential", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const row = await tutorService.createCredential(tutor.id, parsed.data);
  await tutorService.recalculateAndSaveCompletion(tutor.id);
  res.status(201).json(row);
};

export const getCredentialUploadUrl = async (req: AuthRequest, res: Response) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid upload request", error: parsed.error.flatten() });

  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const { upload_url, file_url } = await tutorService.generateCredentialUploadUrl(
    tutor.id,
    parsed.data.filename,
    parsed.data.content_type,
  );
  res.json({ upload_url, file_url });
};

export const search = async (req: AuthRequest, res: Response) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid search", error: parsed.error.flatten() });
  res.json(await tutorService.searchTutors(parsed.data));
};

export const getPublic = async (req: AuthRequest, res: Response) => {
  const profile = await tutorService.getPublicProfile(String(req.params.tutorId));
  if (!profile) return res.status(404).json({ message: "Tutor not found" });
  res.json(profile);
};
