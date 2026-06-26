export interface Payment {
  id: string;
  user_id: string;
  payment_type:
    | "lead_fee"
    | "reveal_fee"
    | "accelerator_subscription"
    | "decision_pack"
    | "corporate_bundle"
    | "keyword_boost";
  amount: string;
  currency: string;
  stripe_payment_id: string | null;
  stripe_invoice_id: string | null;
  status: "pending" | "succeeded" | "failed" | "refunded";
  reference_id: string | null;
  reference_type: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactUnlock {
  id: string;
  quote_id: string;
  tutor_id: string;
  student_id: string;
  job_post_id: string;
  tutor_phone: string | null;
  tutor_email: string | null;
  student_phone: string | null;
  student_email: string | null;
  unlocked_at: Date;
}
