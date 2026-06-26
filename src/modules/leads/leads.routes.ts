import { Router } from "express";
import {
  authenticate,
  requireRole,
  requirePhoneVerified,
} from "../../middleware/auth.middleware";
import * as leadController from "./leads.controller";

const router = Router();

// API.md §6 — tutor lead feed + intent signal.
router.get("/", authenticate, requireRole("tutor"), leadController.feed);
router.post(
  "/:jobPostId/signal",
  authenticate,
  requireRole("tutor"),
  leadController.signalByParam,
);

router.post(
  "/signal",
  authenticate,
  requireRole("tutor"),
  leadController.signalInterest,
);
router.post(
  "/quote",
  authenticate,
  requireRole("tutor"),
  leadController.submitQuote,
);
router.get(
  "/my-quotes",
  authenticate,
  requireRole("tutor"),
  leadController.myQuotes,
);
router.post(
  "/shortlist",
  authenticate,
  requireRole("student"),
  requirePhoneVerified,
  leadController.shortlist,
);
router.delete(
  "/shortlist/:quoteId",
  authenticate,
  requireRole("student"),
  leadController.removeShortlist,
);
router.get(
  "/shortlist/:jobPostId",
  authenticate,
  requireRole("student"),
  leadController.getShortlist,
);

export default router;
