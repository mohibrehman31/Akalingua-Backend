import { Response } from "express";
import db from "../../config/database";
import { AuthRequest } from "../../middleware/auth.middleware";
import { stripe } from "../../config/stripe";
import * as revealService from "./reveal.service";
import * as tutorService from "../tutors/tutors.service";
import * as studentService from "../students/students.service";

const REVEAL_PRICE_EUR = 4; // API.md §3 — €4 flat, free for Accelerator.

export const median = (nums: number[]): number | null => {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
};

// GET /reveal/:jobPostId/eligibility
export const eligibility = async (req: AuthRequest, res: Response) => {
  const jobPostId = String(req.params.jobPostId);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const competing = await revealService.countCompetingQuotes(tutor.id, jobPostId);
  const price = tutor.is_accelerator_subscriber ? 0 : REVEAL_PRICE_EUR;

  if (competing === 0) {
    return res.json({
      eligible: false,
      price,
      currency: "EUR",
      reason: "No competing quotes yet",
    });
  }
  res.json({ eligible: true, price, currency: "EUR" });
};

// POST /reveal/:jobPostId/purchase → { client_secret, payment_id }
export const purchase = async (req: AuthRequest, res: Response) => {
  const jobPostId = String(req.params.jobPostId);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const post = await studentService.getJobPostById(jobPostId);
  if (!post) return res.status(404).json({ message: "Request not found" });

  const competing = await revealService.countCompetingQuotes(tutor.id, jobPostId);
  if (competing === 0)
    return res.status(400).json({ message: "No competing quotes yet" });

  const price = tutor.is_accelerator_subscriber ? 0 : REVEAL_PRICE_EUR;

  let client_secret = "mock_cs_reveal_free";
  let stripePaymentId: string | null = null;
  if (price > 0) {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { type: "reveal_fee", tutor_id: tutor.id, job_post_id: jobPostId, user_id: req.user!.id },
    });
    client_secret = intent.client_secret;
    stripePaymentId = intent.id;
  }

  const [payment] = await db("payments")
    .insert({
      user_id: req.user!.id,
      payment_type: "reveal_fee",
      amount: price,
      currency: "EUR",
      status: price > 0 ? "pending" : "succeeded",
      stripe_payment_id: stripePaymentId,
      reference_id: jobPostId,
      reference_type: "job_post",
    })
    .returning(["id"]);

  // Free (Accelerator) reveals grant immediately.
  if (price === 0) {
    const existing = await revealService.findPurchase(tutor.id, jobPostId);
    if (!existing) await revealService.recordPurchase(tutor.id, jobPostId, 0, "");
  }

  res.json({ client_secret, payment_id: payment.id });
};

// POST /reveal/:paymentId/confirm → 204 (idempotent)
export const confirm = async (req: AuthRequest, res: Response) => {
  const paymentId = String(req.params.paymentId);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const payment = await db("payments").where({ id: paymentId }).first();
  if (!payment || payment.user_id !== req.user!.id)
    return res.status(404).json({ message: "Payment not found" });

  await db("payments").where({ id: paymentId }).update({ status: "succeeded", updated_at: new Date() });

  const jobPostId = payment.reference_id;
  if (jobPostId) {
    const existing = await revealService.findPurchase(tutor.id, jobPostId);
    if (!existing)
      await revealService.recordPurchase(
        tutor.id,
        jobPostId,
        Number(payment.amount),
        payment.stripe_payment_id ?? "",
      );
  }
  res.status(204).send();
};

// GET /reveal/:jobPostId → competitor rate stats
export const data = async (req: AuthRequest, res: Response) => {
  const jobPostId = String(req.params.jobPostId);
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const granted =
    tutor.is_accelerator_subscriber ||
    !!(await revealService.findPurchase(tutor.id, jobPostId));
  if (!granted)
    return res.status(403).json({ message: "Purchase Reveal to view competitor rates" });

  const rates = await revealService.getCompetingRates(tutor.id, jobPostId);
  res.json({
    competitor_quote_count: rates.length,
    competitor_rate_min: rates.length ? Math.min(...rates) : null,
    competitor_rate_max: rates.length ? Math.max(...rates) : null,
    competitor_rate_median: median(rates),
  });
};
