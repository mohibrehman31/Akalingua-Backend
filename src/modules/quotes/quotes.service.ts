import db from "../../config/database";
import { QuoteDTO, QuoteTemplateDTO, QuoteStatus, RateType } from "./quotes.types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
const iso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

const QUOTE_COLUMNS = [
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
];

const toQuoteDTO = (row: any): QuoteDTO => ({
  id: row.id,
  job_post_id: row.job_post_id,
  tutor_id: row.tutor_id,
  student_id: row.student_id,
  status: row.status,
  proposed_rate: Number(row.proposed_rate),
  rate_type: row.rate_type,
  package_sessions: row.package_sessions ?? null,
  cover_message: row.cover_message,
  expires_at: iso(row.expires_at),
  platform_fee_pct: num(row.platform_fee_pct),
  lead_fee_amount: num(row.lead_fee_amount),
  lead_fee_paid: row.lead_fee_paid,
  contact_unlocked: row.contact_unlocked,
  unlocked_at: iso(row.unlocked_at),
  created_at: new Date(row.created_at).toISOString(),
});

export const getExistingQuote = async (jobPostId: string, tutorId: string) => {
  return db("quotes").where({ job_post_id: jobPostId, tutor_id: tutorId }).first();
};

/**
 * Creates a quote per API.md §3: status=pending, 7-day expiry, platform_fee_pct=15,
 * lead_fee_amount=50% of rate. Bumps the post's quote_count. Returns the DTO plus
 * the student's user_id so the caller can notify them.
 */
export const createQuote = async (
  tutorId: string,
  input: {
    job_post_id: string;
    student_id: string;
    proposed_rate: number;
    rate_type: RateType;
    package_sessions?: number | null;
    cover_message: string;
  },
): Promise<{ quote: QuoteDTO; studentUserId: string | undefined }> => {
  return db.transaction(async (trx) => {
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = await trx("quotes")
      .insert({
        job_post_id: input.job_post_id,
        tutor_id: tutorId,
        student_id: input.student_id,
        status: "pending",
        proposed_rate: input.proposed_rate,
        rate_type: input.rate_type,
        package_sessions: input.package_sessions ?? null,
        cover_message: input.cover_message,
        expires_at,
        platform_fee_pct: 15,
        lead_fee_amount: round2(input.proposed_rate * 0.5),
      })
      .returning(QUOTE_COLUMNS);

    await trx("job_posts")
      .where({ id: input.job_post_id })
      .increment("quote_count", 1)
      .update({ updated_at: new Date() });

    const student = await trx("student_profiles")
      .where({ id: input.student_id })
      .select("user_id")
      .first();

    return { quote: toQuoteDTO(row), studentUserId: student?.user_id };
  });
};

export const getMyQuotes = async (
  tutorId: string,
  status?: QuoteStatus,
): Promise<QuoteDTO[]> => {
  const q = db("quotes").where({ tutor_id: tutorId });
  if (status) q.andWhere({ status });
  const rows = await q.select(QUOTE_COLUMNS).orderBy("created_at", "desc");
  return rows.map(toQuoteDTO);
};

const toTemplateDTO = (row: any): QuoteTemplateDTO => ({
  id: row.id,
  name: row.name ?? row.title ?? "",
  cover_message: row.cover_message ?? row.content ?? "",
  proposed_rate: num(row.proposed_rate),
  rate_type: row.rate_type ?? null,
});

export const getTemplates = async (tutorId: string): Promise<QuoteTemplateDTO[]> => {
  const rows = await db("quote_templates")
    .where({ tutor_id: tutorId })
    .orderBy("created_at", "desc");
  return rows.map(toTemplateDTO);
};

export const createTemplate = async (
  tutorId: string,
  input: {
    name: string;
    cover_message: string;
    proposed_rate?: number | null;
    rate_type?: RateType | null;
  },
): Promise<QuoteTemplateDTO> => {
  const [row] = await db("quote_templates")
    .insert({
      tutor_id: tutorId,
      name: input.name,
      cover_message: input.cover_message,
      proposed_rate: input.proposed_rate ?? null,
      rate_type: input.rate_type ?? null,
      // Mirror into the legacy NOT-NULL-turned-nullable columns for old readers.
      title: input.name,
      content: input.cover_message,
    })
    .returning("*");
  return toTemplateDTO(row);
};
