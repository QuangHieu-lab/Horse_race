import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import type { PointsRefModel, PointsTxType } from '../types/shared.types.js';

export interface IPointsTransaction {
  type: PointsTxType;
  points: number;
  balanceAfter: number;
  refModel?: PointsRefModel | null;
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
    refModel?: PointsRefModel,
    refId?: mongoose.Types.ObjectId,
    note?: string,
  ): Promise<HydratedDocument<ISpectatorProfile, ISpectatorProfileMethods>>;
  spendPoints(
    points: number,
    type: PointsTxType,
    refModel?: PointsRefModel,
    refId?: mongoose.Types.ObjectId,
    note?: string,
  ): Promise<HydratedDocument<ISpectatorProfile, ISpectatorProfileMethods>>;
}

type SpectatorProfileModel = Model<
  ISpectatorProfile,
  Record<string, never>,
  ISpectatorProfileMethods
>;

const POINTS_REF_MODELS = ['Prediction', 'Redemption', 'PredictionPool', 'RaceViewingPass', 'Result'] as const;

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    type: {
      type: String,
      enum: [
        'topup',
        'earned_prediction',
        'earned_bonus',
        'spent_redemption',
        'refunded_redemption',
        'spent_pool_entry',
        'earned_pool_share',
        'earned_race_prize_owner',
        'earned_race_prize_jockey',
        'refunded_pool',
        'spent_viewing_ticket',
        'refunded_viewing_ticket',
      ],
      required: true,
    },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    refModel: {
      type: String,
      enum: POINTS_REF_MODELS,
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
  refModel?: PointsRefModel,
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
  type: PointsTxType,
  refModel?: PointsRefModel,
  refId?: mongoose.Types.ObjectId,
  note?: string,
) {
  if (this.currentBalance < points) {
    throw new Error('Insufficient points balance');
  }
  this.totalPointsSpent += points;
  this.currentBalance -= points;
  this.transactions.push({
    type,
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
