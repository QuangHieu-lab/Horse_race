import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import mongoose from 'mongoose';
import { DeviceToken } from '../models/DeviceToken.model.js';

const expo = new Expo();
const REJECTED_TOKEN_ERRORS = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
  'MismatchSenderId',
]);

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(
  userId: mongoose.Types.ObjectId | string,
  payload: PushPayload,
): Promise<void> {
  const tokens = await DeviceToken.find({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  const messages: ExpoPushMessage[] = [];
  const invalidTokens: string[] = [];

  for (const item of tokens) {
    if (!Expo.isExpoPushToken(item.token)) {
      invalidTokens.push(item.token);
      continue;
    }
    messages.push({
      to: item.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: 'high',
      channelId: 'default',
    });
  }

  if (invalidTokens.length > 0) {
    await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
  }

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    const rejectedTokens: string[] = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      const token = chunk[index]?.to;
      const errorCode = ticket.details?.error;
      console.warn('Lỗi gửi thông báo Expo:', errorCode, ticket.message, 'token:', token);
      if (typeof errorCode === 'string' && REJECTED_TOKEN_ERRORS.has(errorCode) && typeof token === 'string') {
        rejectedTokens.push(token);
      }
    });

    if (rejectedTokens.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: rejectedTokens } });
    }
  }
}

export function sendPushToUserBestEffort(
  userId: mongoose.Types.ObjectId | string,
  payload: PushPayload,
): void {
  sendPushToUser(userId, payload).catch((err) => {
    console.warn('Push notification failed:', err);
  });
}
