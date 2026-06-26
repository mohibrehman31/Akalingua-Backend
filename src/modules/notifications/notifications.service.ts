import db from "../../config/database";
import redis from "../../config/redis";
import { Notification } from "./notifications.types";

const cacheKey = (userId: string) => `notif_count:${userId}`;

export const getUnreadCount = async (userId: string): Promise<number> => {
  const cached = await redis.get(cacheKey(userId));
  if (cached !== null) return Number(cached);

  const row = await db("notifications")
    .where({ user_id: userId, is_read: false })
    .count<{ count: string }[]>("id as count")
    .first();
  const count = Number(row?.count ?? 0);
  await redis.set(cacheKey(userId), String(count), "EX", 60);
  return count;
};

export const invalidateUnreadCount = async (userId: string): Promise<void> => {
  await redis.del(cacheKey(userId));
};

export const listNotifications = async (
  userId: string,
  unreadOnly: boolean,
  page: number,
  limit: number,
): Promise<{ data: Notification[]; total: number }> => {
  const offset = (page - 1) * limit;
  const base = db<Notification>("notifications").where({ user_id: userId });
  if (unreadOnly) base.andWhere({ is_read: false });

  const countRow = await base
    .clone()
    .count<{ count: string }[]>("id as count")
    .first();
  const total = Number(countRow?.count ?? 0);

  const rows = await base
    .clone()
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);
  return { data: rows, total };
};

export const createNotification = async (input: {
  user_id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<Notification> => {
  const [row] = await db<Notification>("notifications")
    .insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title ?? null,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
    } as any)
    .returning("*");
  await invalidateUnreadCount(input.user_id);
  return row;
};

export const getNotificationById = async (
  notificationId: string,
): Promise<Notification | undefined> => {
  return db<Notification>("notifications").where({ id: notificationId }).first();
};

export const markRead = async (
  notificationId: string,
): Promise<Notification> => {
  const [row] = await db<Notification>("notifications")
    .where({ id: notificationId })
    .update({ is_read: true, read_at: new Date() })
    .returning("*");
  return row;
};

export const markAllRead = async (userId: string): Promise<number> => {
  const updated = await db("notifications")
    .where({ user_id: userId, is_read: false })
    .update({ is_read: true, read_at: new Date() });
  return updated;
};
