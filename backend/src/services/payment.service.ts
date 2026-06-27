import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Notification } from '../models/Notification.model.js';
import {
  PaymentTransaction,
  type IPaymentTransaction,
  type PaymentProvider,
} from '../models/PaymentTransaction.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import type { PaymentTransactionDto, SpectatorPointsDto } from '../types/api.types.js';
import { HttpError } from '../utils/http-error.js';
import { getOrCreateProfile } from './spectator.service.js';

export const VND_PER_POINT = 1000;
export const MIN_TOPUP_POINTS = 100;

type PayosWebhookPayload = {
  code?: string;
  desc?: string;
  success?: boolean;
  data?: Record<string, unknown>;
  signature?: string;
};

function toPaymentDto(payment: IPaymentTransaction & { _id: mongoose.Types.ObjectId }): PaymentTransactionDto {
  return {
    id: payment._id.toString(),
    provider: payment.provider,
    amountVnd: payment.amountVnd,
    points: payment.points,
    exchangeRateVndPerPoint: payment.exchangeRateVndPerPoint,
    status: payment.status,
    providerTransactionId: payment.providerTransactionId ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    expiredAt: payment.expiredAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

function assertPayosConfigured(): void {
  if (!env.payos.clientId || !env.payos.apiKey || !env.payos.checksumKey) {
    throw new HttpError(500, 'PayOS chưa được cấu hình PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY');
  }
}

function sortData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null && key !== 'signature')
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = data[key];
      return result;
    }, {});
}

function stringifyPayosData(data: Record<string, unknown>): string {
  return Object.entries(sortData(data))
    .map(([key, value]) => {
      const normalized = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}=${normalized}`;
    })
    .join('&');
}

function signPayosData(data: Record<string, unknown>): string {
  return crypto
    .createHmac('sha256', env.payos.checksumKey)
    .update(stringifyPayosData(data))
    .digest('hex');
}

function validateTopUpPoints(points: number): void {
  if (!Number.isInteger(points) || points < MIN_TOPUP_POINTS) {
    throw new HttpError(400, `Số điểm nạp tối thiểu là ${MIN_TOPUP_POINTS} points`);
  }
}

async function getOrCreateSpectatorProfile(userId: mongoose.Types.ObjectId) {
  let profile = await SpectatorProfile.findOne({ userId });
  if (!profile) profile = await SpectatorProfile.create({ userId });
  return profile;
}

async function grantTopUpPoints(payment: typeof PaymentTransaction.prototype): Promise<void> {
  const profile = await getOrCreateSpectatorProfile(payment.userId);
  await profile.addPoints(
    payment.points,
    'topup',
    undefined,
    undefined,
    `Nạp ${payment.points} points (${payment.amountVnd.toLocaleString('vi-VN')} VND)`,
  );

  await Notification.create({
    userId: payment.userId,
    type: 'points_topup',
    title: 'Nạp điểm thành công',
    message: `Bạn đã nạp ${payment.points} points vào ví.`,
  });
}

export async function createMockTopUp(
  userId: string,
  points: number,
  provider: PaymentProvider = 'mock',
): Promise<{ payment: PaymentTransactionDto; points: SpectatorPointsDto }> {
  if (!env.allowMockTopUp) {
    throw new HttpError(403, 'Mock top-up đã bị khóa trên môi trường này');
  }
  validateTopUpPoints(points);

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const amountVnd = points * VND_PER_POINT;
  const providerTransactionId = `${provider}_${Date.now()}_${userObjectId.toString().slice(-6)}`;

  const payment = await PaymentTransaction.create({
    userId: userObjectId,
    provider,
    amountVnd,
    points,
    exchangeRateVndPerPoint: VND_PER_POINT,
    status: 'paid',
    providerTransactionId,
    providerPayload: {
      mode: 'mock-paid',
      note: 'Local demo top-up; disable before production.',
    },
    paidAt: new Date(),
  });

  await grantTopUpPoints(payment);

  return {
    payment: toPaymentDto(payment),
    points: await getOrCreateProfile(userId),
  };
}

export async function createPayosTopUp(
  userId: string,
  points: number,
): Promise<{ payment: PaymentTransactionDto; paymentUrl: string }> {
  assertPayosConfigured();
  validateTopUpPoints(points);

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const amountVnd = points * VND_PER_POINT;
  const expiredAt = new Date(Date.now() + 15 * 60 * 1000);
  const orderCode = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12));

  const payment = await PaymentTransaction.create({
    userId: userObjectId,
    provider: 'payos',
    amountVnd,
    points,
    exchangeRateVndPerPoint: VND_PER_POINT,
    status: 'pending',
    providerTransactionId: String(orderCode),
    providerPayload: {
      provider: 'payos',
      orderCode,
    },
    expiredAt,
  });

  const payload = {
    orderCode,
    amount: amountVnd,
    description: `Topup ${points} pts`,
    returnUrl: env.payos.returnUrl,
    cancelUrl: env.payos.cancelUrl,
  };
  const signature = signPayosData(payload);

  const response = await fetch(`${env.payos.apiUrl}/v2/payment-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': env.payos.clientId,
      'x-api-key': env.payos.apiKey,
    },
    body: JSON.stringify({ ...payload, signature }),
  });
  const body = await response.json() as {
    code?: string;
    desc?: string;
    data?: { checkoutUrl?: string; paymentLinkId?: string };
  };

  if (!response.ok || body.code !== '00' || !body.data?.checkoutUrl) {
    payment.status = 'failed';
    payment.providerPayload = { ...(payment.providerPayload ?? {}), createResponse: body };
    await payment.save();
    throw new HttpError(502, body.desc ?? 'Không tạo được link thanh toán PayOS');
  }

  payment.providerPayload = {
    ...(payment.providerPayload ?? {}),
    paymentLinkId: body.data.paymentLinkId,
    createResponse: body,
  };
  await payment.save();

  return {
    payment: toPaymentDto(payment),
    paymentUrl: body.data.checkoutUrl,
  };
}

export async function confirmPayosPayment(
  orderCode: number,
  payload: Record<string, unknown>,
): Promise<{ code: string; message: string; payment?: PaymentTransactionDto; points?: SpectatorPointsDto }> {
  const payment = await PaymentTransaction.findOne({
    provider: 'payos',
    providerTransactionId: String(orderCode),
  });

  if (!payment) return { code: '01', message: 'Order not found' };

  if (payment.status === 'paid') {
    return {
      code: '00',
      message: 'Order already confirmed',
      payment: toPaymentDto(payment),
      points: await getOrCreateProfile(payment.userId.toString()),
    };
  }

  payment.status = 'paid';
  payment.paidAt = new Date();
  payment.providerPayload = {
    ...(payment.providerPayload ?? {}),
    callback: payload,
  };
  await payment.save();
  await grantTopUpPoints(payment);

  return {
    code: '00',
    message: 'Confirm success',
    payment: toPaymentDto(payment),
    points: await getOrCreateProfile(payment.userId.toString()),
  };
}

export async function handlePayosWebhook(
  payload: PayosWebhookPayload,
): Promise<{ code: string; message: string; payment?: PaymentTransactionDto; points?: SpectatorPointsDto }> {
  assertPayosConfigured();
  const data = payload.data ?? {};
  const signature = payload.signature ?? '';
  if (!signature || signPayosData(data) !== signature) {
    return { code: '97', message: 'Invalid signature' };
  }

  const orderCode = Number(data.orderCode);
  if (!Number.isFinite(orderCode)) {
    return { code: '01', message: 'Invalid orderCode' };
  }

  const amount = Number(data.amount);
  const payment = await PaymentTransaction.findOne({
    provider: 'payos',
    providerTransactionId: String(orderCode),
  });
  if (!payment) return { code: '01', message: 'Order not found' };
  if (amount !== payment.amountVnd) return { code: '04', message: 'Invalid amount' };

  const paymentStatus = String(data.code ?? payload.code ?? '');
  if (paymentStatus && paymentStatus !== '00') {
    payment.status = 'failed';
    payment.providerPayload = { ...(payment.providerPayload ?? {}), callback: payload };
    await payment.save();
    return { code: '02', message: 'Payment failed', payment: toPaymentDto(payment) };
  }

  return confirmPayosPayment(orderCode, payload as Record<string, unknown>);
}

export async function markPayosCancelled(
  orderCode: number,
): Promise<{ payment?: PaymentTransactionDto }> {
  const payment = await PaymentTransaction.findOne({
    provider: 'payos',
    providerTransactionId: String(orderCode),
  });
  if (!payment) return {};
  if (payment.status === 'pending') {
    payment.status = 'cancelled';
    await payment.save();
  }
  return { payment: toPaymentDto(payment) };
}

export async function listTopUps(userId: string): Promise<PaymentTransactionDto[]> {
  const payments = await PaymentTransaction.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .lean();

  return payments.map((payment) =>
    toPaymentDto(payment as IPaymentTransaction & { _id: mongoose.Types.ObjectId }),
  );
}
