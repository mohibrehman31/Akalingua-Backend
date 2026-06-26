import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as notificationsService from "./notifications.service";

export const list = async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unread_only === "true";
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const { data, total } = await notificationsService.listNotifications(
    req.user!.id,
    unreadOnly,
    page,
    limit,
  );
  const unread_count = await notificationsService.getUnreadCount(req.user!.id);

  res.json({ data, unread_count, page, total, limit });
};

export const markRead = async (req: AuthRequest, res: Response) => {
  const notificationId = String(req.params.notificationId);
  const notif = await notificationsService.getNotificationById(notificationId);
  if (!notif) return res.status(404).json({ error: "Resource not found" });
  if (notif.user_id !== req.user!.id)
    return res.status(403).json({ error: "Insufficient permissions" });

  await notificationsService.markRead(notificationId);
  await notificationsService.invalidateUnreadCount(req.user!.id);
  res.status(204).send();
};

export const markAllRead = async (req: AuthRequest, res: Response) => {
  await notificationsService.markAllRead(req.user!.id);
  await notificationsService.invalidateUnreadCount(req.user!.id);
  res.status(204).send();
};
