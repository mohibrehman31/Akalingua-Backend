import Stripe from "stripe";

export const stripe: any = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
  { apiVersion: "2026-06-24.dahlia" },
);
