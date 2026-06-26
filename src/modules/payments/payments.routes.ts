import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as paymentsController from "./payments.controller";

const router = Router();

// Webhook — must be raw body (handled in index.ts)
router.post("/stripe-webhook", paymentsController.stripeWebhook);

router.post(
  "/lead-fee/:quoteId/intent",
  authenticate,
  requireRole("tutor"),
  paymentsController.leadFeeIntent,
);
router.post(
  "/lead-fee/:paymentId/confirm",
  authenticate,
  paymentsController.leadFeeConfirm,
);

router.post(
  "/accelerator/subscribe",
  authenticate,
  requireRole("tutor"),
  paymentsController.subscribeAccelerator,
);
router.post(
  "/accelerator/cancel",
  authenticate,
  requireRole("tutor"),
  paymentsController.cancelAccelerator,
);

router.get("/history", authenticate, paymentsController.history);

export default router;
