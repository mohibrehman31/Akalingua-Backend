export type QuoteStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "expired"
  | "archived";

export type RateType = "hourly" | "package";

// Shape returned to the client — matches API.md §2 Quote exactly (numbers, not
// PG decimal strings).
export interface QuoteDTO {
  id: string;
  job_post_id: string;
  tutor_id: string;
  student_id: string;
  status: QuoteStatus;
  proposed_rate: number;
  rate_type: RateType;
  package_sessions: number | null;
  cover_message: string;
  expires_at: string | null;
  platform_fee_pct: number | null;
  lead_fee_amount: number | null;
  lead_fee_paid: boolean;
  contact_unlocked: boolean;
  unlocked_at: string | null;
  created_at: string;
}

export interface QuoteTemplateDTO {
  id: string;
  name: string;
  cover_message: string;
  proposed_rate: number | null;
  rate_type: RateType | null;
}
