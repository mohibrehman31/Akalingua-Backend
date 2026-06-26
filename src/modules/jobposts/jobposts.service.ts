import db from "../../config/database";
import { JobPost, JobPostCreate } from "../students/students.types";

const SHORTLIST_MAX = 7;
const HOURS_24_MS = 24 * 60 * 60 * 1000;

export const createJobPost = async (
  studentId: string,
  input: JobPostCreate & { shortlist_capacity?: number | null },
): Promise<JobPost> => {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // now + 14 days

  const [row] = await db<JobPost>("job_posts")
    .insert({
      student_id: studentId,
      post_type: input.post_type,
      status: "open",
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
      shortlist_capacity: input.shortlist_capacity ?? SHORTLIST_MAX,
      expires_at: expiresAt,
    } as any)
    .returning("*");
  return row;
};

export const listMine = async (studentId: string): Promise<JobPost[]> => {
  return db<JobPost>("job_posts")
    .where({ student_id: studentId })
    .orderBy("created_at", "desc");
};

export const getById = async (id: string): Promise<JobPost | undefined> => {
  return db<JobPost>("job_posts").where({ id }).first();
};

/**
 * Quotes embedded in the student's job-post detail. Anonymized: only the
 * canonical Quote fields + tutor_id (the student loads the public tutor card
 * separately). No tutor identity leaks here.
 */
export const getAnonymizedQuotes = async (jobPostId: string): Promise<any[]> => {
  return db("quotes")
    .where({ job_post_id: jobPostId })
    .select(
      "id",
      "job_post_id",
      "tutor_id",
      "student_id",
      "status",
      "proposed_rate",
      "rate_type",
      "package_sessions",
      "cover_message",
      "expires_at",
      "platform_fee_pct",
      "lead_fee_amount",
      "lead_fee_paid",
      "contact_unlocked",
      "unlocked_at",
      "created_at",
    )
    .orderBy("created_at", "desc");
};

export const cancel = async (id: string): Promise<void> => {
  await db("job_posts")
    .where({ id })
    .update({ status: "cancelled", updated_at: new Date() });
};

export const hasBeenOpen24h = (post: JobPost): boolean => {
  return Date.now() - new Date(post.created_at).getTime() >= HOURS_24_MS;
};

/** User ids of tutors who have a pending quote on a post (for close notifications). */
export const getPendingQuoteTutorUserIds = async (
  jobPostId: string,
): Promise<string[]> => {
  const rows = await db("quotes as q")
    .innerJoin("tutor_profiles as t", "t.id", "q.tutor_id")
    .where("q.job_post_id", jobPostId)
    .andWhere("q.status", "pending")
    .select("t.user_id as user_id");
  return rows.map((r: any) => r.user_id);
};

export const close = async (id: string): Promise<void> => {
  await db("job_posts")
    .where({ id })
    .update({ status: "closed", updated_at: new Date() });
};

export const repost = async (id: string): Promise<JobPost> => {
  return db.transaction(async (trx) => {
    // Archive any still-live quotes.
    await trx("quotes")
      .where({ job_post_id: id })
      .whereIn("status", ["pending", "shortlisted"])
      .update({ status: "archived", updated_at: new Date() });

    // Drop active shortlist slots so the reset count stays consistent.
    await trx("shortlist_slots")
      .where({ job_post_id: id })
      .whereNull("removed_at")
      .update({ removed_at: new Date(), removal_reason: "repost" });

    const now = new Date();
    const [row] = await trx<JobPost>("job_posts")
      .where({ id })
      .update({
        status: "open",
        created_at: now,
        expires_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // now + 5 days
        shortlist_count: 0,
        quote_count: 0,
        updated_at: now,
      } as any)
      .returning("*");
    return row;
  });
};

// --- Shortlist -------------------------------------------------------------

export const getActiveShortlist = async (jobPostId: string): Promise<any[]> => {
  return db("shortlist_slots")
    .where({ job_post_id: jobPostId })
    .whereNull("removed_at")
    .select(
      "id",
      "job_post_id",
      "tutor_id",
      "quote_id",
      "slot_position",
      "added_at",
      "removed_at",
    )
    .orderBy("slot_position", "asc");
};

export const getQuoteById = async (quoteId: string): Promise<any | undefined> => {
  return db("quotes").where({ id: quoteId }).first();
};

export const getTutorUserId = async (
  tutorId: string,
): Promise<string | undefined> => {
  const row = await db("tutor_profiles").where({ id: tutorId }).select("user_id").first();
  return row?.user_id;
};

export type ShortlistResult =
  | { ok: true; tutor_id: string }
  | { ok: false; status: number; message: string };

export const shortlistQuote = async (
  post: JobPost,
  quoteId: string,
): Promise<ShortlistResult> => {
  return db.transaction(async (trx): Promise<ShortlistResult> => {
    const quote = await trx("quotes").where({ id: quoteId }).first();
    if (!quote || quote.job_post_id !== post.id)
      return { ok: false, status: 404, message: "Quote not found" };

    if (post.shortlist_count >= post.shortlist_capacity)
      return { ok: false, status: 409, message: "Shortlist is full" };

    const existing = await trx("shortlist_slots")
      .where({ job_post_id: post.id, tutor_id: quote.tutor_id })
      .first();
    if (existing && !existing.removed_at)
      return { ok: false, status: 409, message: "Already shortlisted" };

    const activeCount = await trx("shortlist_slots")
      .where({ job_post_id: post.id })
      .whereNull("removed_at")
      .count<{ count: string }[]>("id as count")
      .first();
    const slotPosition = Number(activeCount?.count ?? 0) + 1;

    if (existing) {
      // Re-activate a previously removed slot (unique on job_post_id+tutor_id).
      await trx("shortlist_slots").where({ id: existing.id }).update({
        quote_id: quoteId,
        slot_position: slotPosition,
        added_at: new Date(),
        removed_at: null,
        removal_reason: null,
      });
    } else {
      await trx("shortlist_slots").insert({
        job_post_id: post.id,
        student_id: post.student_id,
        tutor_id: quote.tutor_id,
        quote_id: quoteId,
        slot_position: slotPosition,
      });
    }

    await trx("quotes")
      .where({ id: quoteId })
      .update({ status: "shortlisted", updated_at: new Date() });

    await trx("job_posts")
      .where({ id: post.id })
      .update({
        shortlist_count: post.shortlist_count + 1,
        status: post.status === "open" ? "shortlisting" : post.status,
        updated_at: new Date(),
      });

    return { ok: true, tutor_id: quote.tutor_id };
  });
};

export const removeShortlist = async (
  jobPostId: string,
  quoteId: string,
): Promise<boolean> => {
  return db.transaction(async (trx) => {
    const slot = await trx("shortlist_slots")
      .where({ job_post_id: jobPostId, quote_id: quoteId })
      .whereNull("removed_at")
      .first();
    if (!slot) return false;

    await trx("shortlist_slots")
      .where({ id: slot.id })
      .update({ removed_at: new Date() });

    await trx("quotes")
      .where({ id: quoteId })
      .update({ status: "pending", updated_at: new Date() });

    await trx("job_posts")
      .where({ id: jobPostId })
      .where("shortlist_count", ">", 0)
      .decrement("shortlist_count", 1);

    return true;
  });
};
