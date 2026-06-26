export interface LeadSignal {
  id: string;
  job_post_id: string;
  tutor_id: string;
  created_at: Date;
}

export interface Quote {
  id: string;
  job_post_id: string;
  tutor_id: string;
  student_id: string;
  status: "pending" | "shortlisted" | "accepted" | "rejected" | "expired" | "archived";
  proposed_rate: string;
  rate_type: "hourly" | "package";
  package_sessions: number | null;
  cover_message: string;
  template_used: boolean;
  expires_at: Date | null;
  platform_fee_pct: string | null;
  lead_fee_amount: string | null;
  lead_fee_paid: boolean;
  lead_fee_paid_at: Date | null;
  contact_unlocked: boolean;
  unlocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShortlistSlot {
  id: string;
  job_post_id: string;
  student_id: string;
  tutor_id: string;
  quote_id: string;
  slot_position: number;
  added_at: Date;
  removed_at: Date | null;
  removal_reason: string | null;
}

export interface ChatThread {
  id: string;
  quote_id: string;
  tutor_id: string;
  student_id: string;
  job_post_id: string;
  is_active: boolean;
  created_at: Date;
  last_message_at: Date | null;
}

export interface InterestQueueRow {
  id: string;
  job_post_id: string;
  tutor_id: string;
  queued_at: Date;
  notified_at: Date | null;
  is_active: boolean;
}

export interface QuoteCreate {
  job_post_id: string;
  proposed_rate: number;
  rate_type: "hourly" | "package";
  package_sessions?: number;
  cover_message: string;
  template_used?: boolean;
}
