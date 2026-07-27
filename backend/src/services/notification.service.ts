import mongoose from 'mongoose';
import { DeviceToken, type DevicePlatform } from '../models/DeviceToken.model.js';
import { Notification } from '../models/Notification.model.js';
import type { NotificationRefModel, NotificationType } from '../types/shared.types.js';
import { sendPushToUserBestEffort } from './push-notification.service.js';

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

export interface NotificationInput {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  refModel?: NotificationRefModel | null;
  refId?: mongoose.Types.ObjectId | string | null;
}

function toObjectId(value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

function pushNotification(input: NotificationInput, notificationId: string): void {
  sendPushToUserBestEffort(input.userId, {
    title: input.title,
    body: input.message,
    data: {
      notificationId,
      type: input.type,
      refModel: input.refModel ?? null,
      refId: input.refId?.toString() ?? null,
    },
  });
}

export async function createNotification(input: NotificationInput): Promise<NotificationDto> {
  const created = await Notification.create({
    ...input,
    userId: toObjectId(input.userId),
    refId: input.refId ? toObjectId(input.refId) : null,
  });

  pushNotification(input, created._id.toString());

  return {
    id: created._id.toString(),
    type: created.type,
    title: created.title,
    message: created.message,
    isRead: created.isRead,
    refModel: created.refModel ?? null,
    refId: created.refId?.toString() ?? null,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const created = await Notification.insertMany(
    inputs.map((input) => ({
      ...input,
      userId: toObjectId(input.userId),
      refId: input.refId ? toObjectId(input.refId) : null,
    })),
  );

  created.forEach((notification, index) => {
    const input = inputs[index];
    if (input) pushNotification(input, notification._id.toString());
  });
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

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    },
    { isRead: true },
  );
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: DevicePlatform,
): Promise<void> {
  await DeviceToken.findOneAndUpdate(
    { token },
    {
      $set: {
        userId: new mongoose.Types.ObjectId(userId),
        token,
        platform,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function unregisterDeviceToken(userId: string, token: string): Promise<void> {
  await DeviceToken.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    token,
  });
}
