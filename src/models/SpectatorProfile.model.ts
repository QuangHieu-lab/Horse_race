import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import type { PointsTxType } from '../types/shared.types.js';

export interface IPointsTransaction {
  type: PointsTxType;
  points: number;
  balanceAfter: number;
  refModel?: 'Prediction' | 'Redemption' | 'PredictionPool' | null;
  refId?: mongoose.Types.ObjectId | null;
  note?: string;
  createdAt: Date;
}

export interface ISpectatorProfile {
  userId: mongoose.Types.ObjectId;
  totalPointsEarned: number;
  totalPointsSpent: number;
  currentBalance: number;
  transactions: IPointsTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISpectatorProfileMethods {
  addPoints(
    points: number,
    type: PointsTxType,
    refModel?: 'Prediction' | 'Redemption' | 'PredictionPool',
    refId?: mongoose.Types.ObjectId,
    note?: string,
  ): Promise<HydratedDocument<ISpectatorProfile, ISpectatorProfileMethods>>;
  spendPoints(
    points: number,
    refModel?: 'Prediction' | 'Redemption' | 'PredictionPool',
    refId?: mongoose.Types.ObjectId,
    note?: string,
  ): Promise<HydratedDocument<ISpectatorProfile, ISpectatorProfileMethods>>;
}

type SpectatorProfileModel = Model<
  ISpectatorProfile,
  Record<string, never>,
  ISpectatorProfileMethods
>;

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    type: {
      type: String,
      enum: [
        'earned_prediction',
        'earned_bonus',
        'spent_redemption',
        'refunded_redemption',
        'spent_pool_entry',
        'earned_pool_share',
        'refunded_pool',
      ],
      required: true,
    },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    refModel: {
      type: String,
      enum: ['Prediction', 'Redemption', 'PredictionPool'],
      default: null,
    },
    refId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const SpectatorProfileSchema = new Schema<
  ISpectatorProfile,
  SpectatorProfileModel,
  ISpectatorProfileMethods
>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    totalPointsEarned: { type: Number, default: 0, min: 0 },
    totalPointsSpent: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
    transactions: { type: [PointsTransactionSchema], default: [] },
  },
  { timestamps: true },
);

SpectatorProfileSchema.methods.addPoints = async function (
  points: number,
  type: PointsTxType,
  refModel?: 'Prediction' | 'Redemption' | 'PredictionPool',
  refId?: mongoose.Types.ObjectId,
  note?: string,
) {
  this.totalPointsEarned += points;
  this.currentBalance += points;
  this.transactions.push({
    type,
    points,
    balanceAfter: this.currentBalance,
    refModel: refModel ?? null,
    refId: refId ?? null,
    note,
    createdAt: new Date(),
  });
  return this.save();
};

SpectatorProfileSchema.methods.spendPoints = async function (
  points: number,
  refModel?: 'Prediction' | 'Redemption' | 'PredictionPool',
  refId?: mongoose.Types.ObjectId,
  note?: string,
) {
  if (this.currentBalance < points) {
    throw new Error('Insufficient points balance');
  }
  this.totalPointsSpent += points;
  this.currentBalance -= points;
  this.transactions.push({
    type: 'spent_redemption',
    points: -points,
    balanceAfter: this.currentBalance,
    refModel: refModel ?? null,
    refId: refId ?? null,
    note,
    createdAt: new Date(),
  });
  return this.save();
};

SpectatorProfileSchema.index({ currentBalance: -1 });
SpectatorProfileSchema.index({ totalPointsEarned: -1 });

export const SpectatorProfile = mongoose.model<ISpectatorProfile, SpectatorProfileModel>(
  'SpectatorProfile',
  SpectatorProfileSchema,
);
