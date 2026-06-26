import { Knex } from "knex";
import db from "../../config/database";
import redis from "../../config/redis";
import {
  LeadSignal,
  Quote,
  ShortlistSlot,
  ChatThread,
  InterestQueueRow,
  QuoteCreate,
} from "./leads.types";

// Anonymized JobPost columns a tutor may see (§12: no student PII beyond student_id).
const LEAD_COLUMNS = [
  "jp.id",
  "jp.student_id",
  "jp.post_type",
  "jp.status",
  "jp.target_language_code",
  "jp.target_language_name",
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
  "jp.additional_notes",
  "jp.shortlist_capacity",
  "jp.shortlist_count",
  "jp.quote_count",
  "jp.expires_at",
  "jp.created_at",
];

const serializeLead = (row: any) => ({
  ...row,
  budget_min: row.budget_min === null ? null : Number(row.budget_min),
  budget_max: row.budget_max === null ? null : Number(row.budget_max),
});

// Lead feed per API.md §3/§6: open/shortlisting posts, not already-quoted, language
// match (no languages → all), Accelerator 10-min early access, newest-first.
export const getLeadFeed = async (
  tutorId: string,
  isAccelerator: boolean,
  filters: {
    language?: string;
    delivery?: string;
    level?: string;
    minBudget?: number;
    maxBudget?: number;
  },
  page: number,
  limit: number,
): Promise<{ data: any[]; total: number; page: number; limit: number }> => {
  const codeRows = await db("tutor_languages")
    .where({ tutor_id: tutorId })
    .select("language_code");
  const codes = codeRows.map((r: any) => r.language_code);

  const now = new Date();
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000);

  const base = db("job_posts as jp")
    .whereIn("jp.status", ["open", "shortlisting"])
    .andWhere(function () {
      this.whereNull("jp.expires_at").orWhere("jp.expires_at", ">", now);
    })
    .whereNotExists(function () {
      this.select(db.raw("1"))
        .from("quotes as q")
        .whereRaw("q.job_post_id = jp.id")
        .andWhere("q.tutor_id", tutorId);
    });

  if (filters.language) base.andWhere("jp.target_language_code", filters.language);
  else if (codes.length) base.whereIn("jp.target_language_code", codes);

  if (filters.delivery) base.andWhere("jp.delivery_mode", filters.delivery);
  if (filters.level) base.andWhere("jp.current_level", filters.level);
  if (filters.minBudget !== undefined) {
    base.andWhere(function () {
      this.whereNull("jp.budget_max").orWhere("jp.budget_max", ">=", filters.minBudget as number);
    });
  }
  if (filters.maxBudget !== undefined) {
    base.andWhere(function () {
      this.whereNull("jp.budget_min").orWhere("jp.budget_min", "<=", filters.maxBudget as number);
    });
  }
  if (!isAccelerator) base.andWhere("jp.created_at", "<=", cutoff);

  const totalRow = await base
    .clone()
    .clearSelect()
    .count<{ count: string }[]>("jp.id as count")
    .first();
  const total = Number(totalRow?.count ?? 0);

  const offset = (page - 1) * limit;
  const rows = await base
    .clone()
    .select(LEAD_COLUMNS)
    .orderBy("jp.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return { data: rows.map(serializeLead), total, page, limit };
};

export const findSignal = async (
  jobPostId: string,
  tutorId: string,
): Promise<LeadSignal | undefined> => {
  return db<LeadSignal>("lead_signals")
    .where({ job_post_id: jobPostId, tutor_id: tutorId })
    .first();
};

export const createSignal = async (
  jobPostId: string,
  tutorId: string,
): Promise<LeadSignal> => {
  const [row] = await db<LeadSignal>("lead_signals")
    .insert({ job_post_id: jobPostId, tutor_id: tutorId })
    .returning("*");
  return row;
};

export const getQuoteByJobAndTutor = async (
  jobPostId: string,
  tutorId: string,
): Promise<Quote | undefined> => {
  return db<Quote>("quotes")
    .where({ job_post_id: jobPostId, tutor_id: tutorId })
    .first();
};

export const getQuoteById = async (
  quoteId: string,
): Promise<Quote | undefined> => {
  return db<Quote>("quotes").where({ id: quoteId }).first();
};

export const createQuoteWithThread = async (
  tutorId: string,
  studentId: string,
  input: QuoteCreate,
  platformFeePct: number,
  shortlistFull: boolean,
): Promise<{ quote: Quote; thread: ChatThread; queued: boolean }> => {
  return db.transaction(async (trx) => {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [quote] = await trx<Quote>("quotes")
      .insert({
        job_post_id: input.job_post_id,
        tutor_id: tutorId,
        student_id: studentId,
        proposed_rate: input.proposed_rate,
        rate_type: input.rate_type,
        package_sessions: input.package_sessions ?? null,
        cover_message: input.cover_message,
        template_used: input.template_used ?? false,
        expires_at: expires,
        platform_fee_pct: platformFeePct,
      } as any)
      .returning("*");

    await trx("job_posts")
      .where({ id: input.job_post_id })
      .increment("quote_count", 1)
      .update({ updated_at: new Date() });

    const [thread] = await trx<ChatThread>("chat_threads")
      .insert({
        quote_id: quote.id,
        tutor_id: tutorId,
        student_id: studentId,
        job_post_id: input.job_post_id,
      })
      .returning("*");

    let queued = false;
    if (shortlistFull) {
      const existing = await trx("interest_queue")
        .where({ job_post_id: input.job_post_id, tutor_id: tutorId })
        .first();
      if (!existing) {
        await trx("interest_queue").insert({
          job_post_id: input.job_post_id,
          tutor_id: tutorId,
        });
      }
      queued = true;
    }

    return { quote, thread, queued };
  });
};

export const getMyQuotes = async (
  tutorId: string,
  statusFilter?: string,
): Promise<any[]> => {
  const q = db("quotes as q")
    .innerJoin("job_posts as jp", "jp.id", "q.job_post_id")
    .innerJoin("student_profiles as sp", "sp.id", "q.student_id")
    .where("q.tutor_id", tutorId);

  if (statusFilter) q.andWhere("q.status", statusFilter);

  return q
    .select(
      "q.id",
      "q.proposed_rate",
      "q.rate_type",
      "q.status",
      "q.contact_unlocked",
      "q.created_at",
      "q.expires_at",
      "q.lead_fee_amount",
      "q.lead_fee_paid",
      "jp.id as job_post_id",
      "jp.target_language_name",
      "jp.current_level",
      "jp.objective",
      "jp.delivery_mode",
      "sp.first_name as student_first_name",
    )
    .orderBy("q.created_at", "desc");
};

export const shortlistQuote = async (
  studentId: string,
  quoteId: string,
): Promise<{ quote: Quote; slot: ShortlistSlot; jobPostStatus: string }> => {
  return db.transaction(async (trx) => {
    const quote = await trx<Quote>("quotes").where({ id: quoteId }).first();
    if (!quote) throw new Error("QUOTE_NOT_FOUND");
    if (quote.student_id !== studentId) throw new Error("FORBIDDEN");
    if (quote.status !== "pending") throw new Error("QUOTE_NOT_PENDING");

    const job = await trx("job_posts").where({ id: quote.job_post_id }).first();
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.shortlist_count >= job.shortlist_capacity) {
      const err = new Error("SHORTLIST_FULL");
      (err as any).capacity = job.shortlist_capacity;
      throw err;
    }

    const maxRow = await trx("shortlist_slots")
      .where({ job_post_id: quote.job_post_id })
      .max<{ max: number | null }[]>("slot_position as max");
    const nextPos = (maxRow[0]?.max ?? 0) + 1;

    const pct = quote.platform_fee_pct
      ? Number(quote.platform_fee_pct)
      : job.post_type === "broadcast"
      ? 7.5
      : 10.0;
    const lead_fee_amount = Number(
      (Number(quote.proposed_rate) * pct / 100).toFixed(2),
    );

    const [updatedQuote] = await trx<Quote>("quotes")
      .where({ id: quoteId })
      .update({
        status: "shortlisted",
        lead_fee_amount,
        updated_at: new Date(),
      } as any)
      .returning("*");

    const [slot] = await trx<ShortlistSlot>("shortlist_slots")
      .insert({
        job_post_id: quote.job_post_id,
        student_id: studentId,
        tutor_id: quote.tutor_id,
        quote_id: quote.id,
        slot_position: nextPos,
      })
      .returning("*");

    const newCount = job.shortlist_count + 1;
    const newStatus =
      newCount >= job.shortlist_capacity ? "shortlisting" : job.status;

    await trx("job_posts")
      .where({ id: job.id })
      .update({
        shortlist_count: newCount,
        status: newStatus,
        updated_at: new Date(),
      });

    await redis.set(`shortlist_count:${job.id}`, String(newCount));

    return { quote: updatedQuote, slot, jobPostStatus: newStatus };
  });
};

export const removeFromShortlist = async (
  studentId: string,
  quoteId: string,
): Promise<{ ok: boolean; notifiedTutorId?: string }> => {
  return db.transaction(async (trx) => {
    const slot = await trx<ShortlistSlot>("shortlist_slots")
      .where({ quote_id: quoteId })
      .whereNull("removed_at")
      .first();
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (slot.student_id !== studentId) throw new Error("FORBIDDEN");

    const quote = await trx<Quote>("quotes").where({ id: quoteId }).first();
    if (!quote) throw new Error("QUOTE_NOT_FOUND");
    if (quote.lead_fee_paid) throw new Error("LEAD_FEE_ALREADY_PAID");

    await trx("shortlist_slots")
      .where({ id: slot.id })
      .update({ removed_at: new Date() });

    await trx("quotes")
      .where({ id: quoteId })
      .update({ status: "pending", updated_at: new Date() });

    await trx("job_posts")
      .where({ id: slot.job_post_id })
      .decrement("shortlist_count", 1)
      .update({ status: "open", updated_at: new Date() });

    await redis.decr(`shortlist_count:${slot.job_post_id}`);

    const next = await trx<InterestQueueRow>("interest_queue")
      .where({ job_post_id: slot.job_post_id, is_active: true })
      .whereNull("notified_at")
      .orderBy("queued_at", "asc")
      .first();

    let notifiedTutorId: string | undefined;
    if (next) {
      await trx("interest_queue")
        .where({ id: next.id })
        .update({ notified_at: new Date() });
      notifiedTutorId = next.tutor_id;
    }

    return { ok: true, notifiedTutorId };
  });
};

export const getShortlistForJob = async (
  jobPostId: string,
): Promise<any[]> => {
  return db("shortlist_slots as ss")
    .innerJoin("tutor_profiles as t", "t.id", "ss.tutor_id")
    .innerJoin("quotes as q", "q.id", "ss.quote_id")
    .where("ss.job_post_id", jobPostId)
    .whereNull("ss.removed_at")
    .select(
      "ss.id as slot_id",
      "ss.slot_position",
      "ss.added_at",
      "t.id as tutor_id",
      "t.display_name",
      "t.first_name",
      "t.avatar_url",
      "t.overall_rating",
      "q.id as quote_id",
      "q.proposed_rate",
      "q.rate_type",
      "q.cover_message",
      "q.lead_fee_amount",
      "q.lead_fee_paid",
      "q.contact_unlocked",
    )
    .orderBy("ss.slot_position", "asc");
};
