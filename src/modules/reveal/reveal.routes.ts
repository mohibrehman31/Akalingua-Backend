import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as revealController from "./reveal.controller";

const router = Router();
const tutor = [authenticate, requireRole("tutor")] as const;

router.get("/:jobPostId/eligibility", ...tutor, revealController.eligibility);
router.post("/:jobPostId/purchase", ...tutor, revealController.purchase);
router.post("/:paymentId/confirm", ...tutor, revealController.confirm);
router.get("/:jobPostId", ...tutor, revealController.data);

export default router;
