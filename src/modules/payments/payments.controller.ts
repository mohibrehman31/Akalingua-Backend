import { Request, Response } from "express";
import db from "../../config/database";
import { AuthRequest } from "../../middleware/auth.middleware";
import { stripe } from "../../config/stripe";
import * as paymentsService from "./payments.service";
import * as tutorService from "../tutors/tutors.service";
import * as notificationsService from "../notifications/notifications.service";

// POST /payments/lead-fee/:quoteId/intent
export const leadFeeIntent = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  const quote = await db("quotes").where({ id: String(req.params.quoteId) }).first();
  // Cross-tenant / missing → 404 (don't leak existence, §12).
  if (!quote || quote.tutor_id !== tutor.id)
    return res.status(404).json({ message: "Quote not found" });
  if (quote.lead_fee_paid)
    return res.status(400).json({ message: "Lead fee already paid" });
  if (quote.status !== "shortlisted")
    return res.status(400).json({ message: "Quote is not shortlisted" });
  if (!quote.lead_fee_amount)
    return res.status(400).json({ message: "Lead fee amount is not set" });

  const amount = Number(quote.lead_fee_amount);
  const customerId = await paymentsService.getOrCreateStripeCustomerForTutor(tutor.id);

  const [payment] = await db("payments")
    .insert({
      user_id: req.user!.id,
      payment_type: "lead_fee",
      amount,
      currency: "EUR",
      status: "pending",
      reference_id: quote.id,
      reference_type: "quote",
    })
    .returning(["id"]);

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "eur",
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      type: "lead_fee",
      quote_id: quote.id,
      payment_id: payment.id,
      tutor_id: tutor.id,
      student_id: quote.student_id,
      job_post_id: quote.job_post_id,
      user_id: req.user!.id,
    },
  });

  await db("payments").where({ id: payment.id }).update({ stripe_payment_id: intent.id });

  res.json({
    client_secret: intent.client_secret,
    amount,
    currency: "EUR",
    payment_id: payment.id,
  });
};

// POST /payments/lead-fee/:paymentId/confirm → { contact_unlocked: true } (idempotent)
export const leadFeeConfirm = async (req: AuthRequest, res: Response) => {
  const payment = await db("payments").where({ id: String(req.params.paymentId) }).first();
  if (!payment || payment.user_id !== req.user!.id)
    return res.status(404).json({ message: "Payment not found" });

  await paymentsService.markPaymentSucceeded(payment.id);

  const result = await paymentsService.unlockQuote(payment.reference_id);
  if (!result) return res.status(404).json({ message: "Quote not found" });

  if (!result.alreadyUnlocked) {
    for (const userId of [result.studentUserId, result.tutorUserId]) {
      if (!userId) continue;
      await notificationsService.createNotification({
        user_id: userId,
        type: "contact_unlocked",
        title: "Contact unlocked",
        body: "You can now exchange contact details.",
        metadata: { quote_id: payment.reference_id },
      });
    }
  }

  res.json({ contact_unlocked: true });
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return res.status(400).json({ error: "Missing signature or secret" });
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    console.error("Stripe signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const type = pi.metadata?.type;
        if (type === "lead_fee") {
          await paymentsService.handleLeadFeeSucceeded(pi);
        } else if (type === "reveal_fee") {
          // Handled by /reveal/confirm endpoint — acknowledge
        } else {
          console.log(`[stripe] payment_intent.succeeded type=${type}`);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await paymentsService.handleSubscriptionUpsert(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await paymentsService.handleSubscriptionDeleted(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await paymentsService.handleInvoicePaymentFailed(invoice);
        break;
      }
      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
  }

  res.status(200).json({ received: true });
};

// POST /payments/accelerator/subscribe → { client_secret }
// API.md §3/§9: flips is_accelerator_subscriber and records a 70 EUR payment.
// ponytail: mock-style immediate activation; the Stripe-subscription/webhook path
// stays available in payments.service for prod hardening if needed.
export const subscribeAccelerator = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  await db("tutor_profiles")
    .where({ id: tutor.id })
    .update({ is_accelerator_subscriber: true, updated_at: new Date() });

  await db("payments").insert({
    user_id: req.user!.id,
    payment_type: "accelerator_subscription",
    amount: 70,
    currency: "EUR",
    status: "succeeded",
    reference_type: "accelerator",
  });

  res.json({ client_secret: "mock_cs_accelerator" });
};

// POST /payments/accelerator/cancel → 204
export const cancelAccelerator = async (req: AuthRequest, res: Response) => {
  const tutor = await tutorService.getTutorByUserId(req.user!.id);
  if (!tutor) return res.status(404).json({ message: "Tutor profile not found" });

  await db("tutor_profiles")
    .where({ id: tutor.id })
    .update({ is_accelerator_subscriber: false, updated_at: new Date() });
  res.status(204).send();
};

// GET /payments/history — paginated (limit=20), newest-first.
export const history = async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const { data, total } = await paymentsService.getPaymentsPage(req.user!.id, page, limit);
  res.json({ data, total, page, limit });
};
