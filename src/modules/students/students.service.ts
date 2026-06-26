import db from "../../config/database";
import {
  StudentProfile,
  StudentProfileUpdate,
  JobPost,
  JobPostCreate,
} from "./students.types";

export const getStudentByUserId = async (
  userId: string,
): Promise<StudentProfile | undefined> => {
  return db<StudentProfile>("student_profiles").where({ user_id: userId }).first();
};

/**
 * Returns the student's profile, creating an empty one if it doesn't exist yet.
 * Registration normally seeds first/last name; this is a safety net so
 * `GET /students/me` never 404s for a valid student user.
 */
export const getOrCreateStudentProfile = async (
  userId: string,
): Promise<StudentProfile> => {
  const existing = await getStudentByUserId(userId);
  if (existing) return existing;
  const [created] = await db<StudentProfile>("student_profiles")
    .insert({ user_id: userId, first_name: "", last_name: "" } as any)
    .returning("*");
  return created;
};

export const getStudentById = async (
  studentId: string,
): Promise<StudentProfile | undefined> => {
  return db<StudentProfile>("student_profiles").where({ id: studentId }).first();
};

export const updateStudentProfile = async (
  studentId: string,
  patch: StudentProfileUpdate,
): Promise<StudentProfile> => {
  const [updated] = await db<StudentProfile>("student_profiles")
    .where({ id: studentId })
    .update({ ...patch, updated_at: new Date() })
    .returning("*");
  return updated;
};

export const setAvatar = async (
  studentId: string,
  avatarUrl: string,
): Promise<StudentProfile> => {
  const [updated] = await db<StudentProfile>("student_profiles")
    .where({ id: studentId })
    .update({ avatar_url: avatarUrl, updated_at: new Date() })
    .returning("*");
  return updated;
};

export const createJobPost = async (
  studentId: string,
  input: JobPostCreate,
): Promise<JobPost> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [row] = await db<JobPost>("job_posts")
    .insert({
      student_id: studentId,
      post_type: input.post_type,
      target_language_code: input.target_language_code,
      target_language_name: input.target_language_name,
      dialect_preference: input.dialect_preference ?? null,
      current_level: input.current_level,
      skill_gaps: input.skill_gaps ?? [],
      objective: input.objective,
      exam_target: input.exam_target ?? null,
      frequency: input.frequency,
      duration: input.duration,
      delivery_mode: input.delivery_mode,
      location_postcode: input.location_postcode ?? null,
      location_district: input.location_district ?? null,
      native_speaker_required: input.native_speaker_required ?? false,
      budget_min: input.budget_min ?? null,
      budget_max: input.budget_max ?? null,
      additional_notes: input.additional_notes ?? null,
      shortlist_capacity: 7,
      expires_at: expiresAt,
    } as any)
    .returning("*");
  return row;
};

export const listJobPostsForStudent = async (
  studentId: string,
): Promise<JobPost[]> => {
  return db<JobPost>("job_posts")
    .where({ student_id: studentId })
    .orderBy("created_at", "desc");
};

export const getJobPostById = async (
  jobPostId: string,
): Promise<JobPost | undefined> => {
  return db<JobPost>("job_posts").where({ id: jobPostId }).first();
};

export const getQuotesForJobPost = async (jobPostId: string): Promise<any[]> => {
  return db("quotes as q")
    .innerJoin("tutor_profiles as t", "t.id", "q.tutor_id")
    .where("q.job_post_id", jobPostId)
    .select(
      "q.id",
      "q.proposed_rate",
      "q.rate_type",
      "q.package_sessions",
      "q.cover_message",
      "q.status",
      "q.contact_unlocked",
      "q.created_at",
      "q.expires_at",
      "t.id as tutor_id",
      "t.display_name as tutor_display_name",
      "t.avatar_url as tutor_avatar_url",
      "t.overall_rating",
      "t.total_reviews",
    )
    .orderBy("q.created_at", "desc");
};

export const cancelJobPost = async (jobPostId: string): Promise<JobPost> => {
  const [row] = await db<JobPost>("job_posts")
    .where({ id: jobPostId })
    .update({ status: "cancelled", updated_at: new Date() })
    .returning("*");
  return row;
};

export const getTutorLanguageCodes = async (
  tutorId: string,
): Promise<string[]> => {
  const rows = await db("tutor_languages")
    .where({ tutor_id: tutorId })
    .select("language_code");
  return rows.map((r: any) => r.language_code);
};

export const getFeedForTutor = async (
  tutorId: string,
  isAccelerator: boolean,
  page: number,
  limit: number,
): Promise<{ data: any[]; total: number; page: number; limit: number }> => {
  const codes = await getTutorLanguageCodes(tutorId);
  if (codes.length === 0) return { data: [], total: 0, page, limit };

  const now = new Date();
  const headStartMinutes = 10;
  const cutoffForStandard = new Date(now.getTime() - headStartMinutes * 60 * 1000);

  const base = db("job_posts as jp")
    .whereIn("jp.status", ["open", "shortlisting"])
    .andWhere(function () {
      this.whereNull("jp.expires_at").orWhere("jp.expires_at", ">", now);
    })
    .andWhere(function () {
      this.whereIn("jp.target_language_code", codes);
    });

  if (!isAccelerator) {
    base.andWhere("jp.created_at", "<=", cutoffForStandard);
  }

  const countRow = await base
    .clone()
    .clearSelect()
    .count<{ count: string }[]>("jp.id as count")
    .first();
  const total = Number(countRow?.count ?? 0);

  const offset = (page - 1) * limit;
  const rows = await base
    .clone()
    .select(
      "jp.id",
      "jp.post_type",
      "jp.target_language_name",
      "jp.target_language_code",
      "jp.dialect_preference",
      "jp.current_level",
      "jp.skill_gaps",
      "jp.objective",
      "jp.exam_target",
      "jp.frequency",
      "jp.duration",
      "jp.delivery_mode",
      "jp.location_district",
      "jp.native_speaker_required",
      "jp.budget_min",
      "jp.budget_max",
      "jp.shortlist_count",
      "jp.shortlist_capacity",
      "jp.quote_count",
      "jp.created_at",
    )
    .orderBy("jp.created_at", "desc")
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r: any) => r.id);
  if (ids.length === 0) return { data: [], total, page, limit };

  const signals = await db("lead_signals")
    .where({ tutor_id: tutorId })
    .whereIn("job_post_id", ids)
    .select("job_post_id");
  const signalSet = new Set(signals.map((s: any) => s.job_post_id));

  const quotes = await db("quotes")
    .where({ tutor_id: tutorId })
    .whereIn("job_post_id", ids)
    .select("job_post_id");
  const quoteSet = new Set(quotes.map((q: any) => q.job_post_id));

  const decorated = rows.map((row: any) => ({
    ...row,
    location_country: null,
    has_signalled: signalSet.has(row.id),
    has_quoted: quoteSet.has(row.id),
    slots_remaining: Math.max(0, row.shortlist_capacity - row.shortlist_count),
  }));

  return { data: decorated, total, page, limit };
};
