export interface RevealPurchase {
  id: string;
  job_post_id: string;
  tutor_id: string;
  price_paid: string;
  stripe_charge_id: string | null;
  purchased_at: Date;
}
