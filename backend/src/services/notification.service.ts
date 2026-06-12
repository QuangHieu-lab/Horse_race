import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import type { NotificationRefModel } from '../types/shared.types.js';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  refModel?: NotificationRefModel | null;
  refId?: string | null;
  createdAt: string;
}

export async function listNotificationsForUser(
  userId: string,
  limit = 50,
): Promise<NotificationDto[]> {
  const items = await Notification.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return items.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    refModel: n.refModel ?? null,
    refId: n.refId?.toString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (!mongoose.isValidObjectId(notificationId)) return;
  await Notification.updateOne(
    {
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
    },
    { isRead: true },
  );
}
