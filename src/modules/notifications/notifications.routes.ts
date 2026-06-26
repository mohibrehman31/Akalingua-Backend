import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import * as notificationsController from "./notifications.controller";

const router = Router();

router.get("/", authenticate, notificationsController.list);
router.post(
  "/:notificationId/read",
  authenticate,
  notificationsController.markRead,
);
router.post("/read-all", authenticate, notificationsController.markAllRead);

export default router;
