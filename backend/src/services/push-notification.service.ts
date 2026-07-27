import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import mongoose from 'mongoose';
import { DeviceToken } from '../models/DeviceToken.model.js';

const expo = new Expo();

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
    });
  }

  if (invalidTokens.length > 0) {
    await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
  }

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    const rejectedTokens = tickets
      .map((ticket, index) => ({ ticket, token: chunk[index]?.to }))
      .filter(({ ticket }) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered')
      .flatMap(({ token }) => (Array.isArray(token) ? token : token ? [token] : []));

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
