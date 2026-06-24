import mongoose from 'mongoose';
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

export const VND_PER_POINT = 100;
export const MIN_TOPUP_POINTS = 100;

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

async function getOrCreateSpectatorProfile(userId: mongoose.Types.ObjectId) {
  let profile = await SpectatorProfile.findOne({ userId });
  if (!profile) profile = await SpectatorProfile.create({ userId });
  return profile;
}

export async function createMockTopUp(
  userId: string,
  points: number,
  provider: PaymentProvider = 'mock',
): Promise<{ payment: PaymentTransactionDto; points: SpectatorPointsDto }> {
  if (!Number.isInteger(points) || points < MIN_TOPUP_POINTS) {
    throw new HttpError(400, `Số điểm nạp tối thiểu là ${MIN_TOPUP_POINTS} points`);
  }

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
      note: 'MVP mock payment; replace with FDI webhook verification later.',
    },
    paidAt: new Date(),
  });

  const profile = await getOrCreateSpectatorProfile(userObjectId);
  await profile.addPoints(
    points,
    'topup',
    undefined,
    undefined,
    `Nạp ${points} points (${amountVnd.toLocaleString('vi-VN')} VND)`,
  );

  await Notification.create({
    userId: userObjectId,
    type: 'points_topup',
    title: 'Nạp điểm thành công',
    message: `Bạn đã nạp ${points} points vào ví.`,
  });

  return {
    payment: toPaymentDto(payment),
    points: await getOrCreateProfile(userId),
  };
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

