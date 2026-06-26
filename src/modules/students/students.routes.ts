import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as studentController from "./students.controller";

const router = Router();

// Student's own profile (settings page)
router.get(
  "/me",
  authenticate,
  requireRole("student"),
  studentController.getMyProfile,
);
router.patch(
  "/me",
  authenticate,
  requireRole("student"),
  studentController.updateMyProfile,
);
router.post(
  "/me/avatar/upload-url",
  authenticate,
  requireRole("student"),
  studentController.getAvatarUploadUrl,
);

// Tutor-facing lead feed (kept here; tutor dashboard surface)
router.get(
  "/job-posts/feed",
  authenticate,
  requireRole("tutor"),
  studentController.getFeed,
);

export default router;
