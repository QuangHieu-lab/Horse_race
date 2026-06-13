import mongoose, { Schema } from 'mongoose';
import type { PredictionPoolStatus } from '../types/shared.types.js';

export interface IPredictionPool {
  raceId: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  status: PredictionPoolStatus;
  ticketPrice: number;
  minRiskMultiplier: number;
  maxRiskMultiplier: number;
  quickRiskMultipliers: number[];
  totalTickets: number;
  totalBountyPool: number;
  organizerFeeRate: number;
  racingRewardRate: number;
  spectatorRewardRate: number;
  ownerShareRate: number;
  jockeyShareRate: number;
  organizerFee: number;
  racingRewardPool: number;
  spectatorRewardPool: number;
  ownerReward: number;
  jockeyReward: number;
  racingRewards: Array<{
    rank: number;
    horseId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;
    jockeyId: mongoose.Types.ObjectId;
    horseReward: number;
    ownerReward: number;
    jockeyReward: number;
    isDeadHeat: boolean;
  }>;
  jackpotAmount: number;
  contributorCount: number;
  totalWinnerScore: number;
  settledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RacingRewardSchema = new Schema(
  {
    rank: { type: Number, required: true, min: 1 },
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jockeyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    horseReward: { type: Number, required: true, min: 0 },
    ownerReward: { type: Number, required: true, min: 0 },
    jockeyReward: { type: Number, required: true, min: 0 },
    isDeadHeat: { type: Boolean, default: false },
  },
  { _id: false },
);

const PredictionPoolSchema = new Schema<IPredictionPool>(
  {
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true, unique: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    status: {
      type: String,
      enum: ['open', 'locked', 'settled'],
      default: 'open',
    },
    ticketPrice: { type: Number, default: 50000, min: 0 },
    minRiskMultiplier: { type: Number, default: 1, min: 1 },
    maxRiskMultiplier: { type: Number, default: 10, min: 1 },
    quickRiskMultipliers: { type: [Number], default: () => [1, 2, 3, 6] },
    totalTickets: { type: Number, default: 0, min: 0 },
    totalBountyPool: { type: Number, default: 0, min: 0 },
    organizerFeeRate: { type: Number, default: 10, min: 0, max: 100 },
    racingRewardRate: { type: Number, default: 15, min: 0, max: 100 },
    spectatorRewardRate: { type: Number, default: 75, min: 0, max: 100 },
    ownerShareRate: { type: Number, default: 80, min: 0, max: 100 },
    jockeyShareRate: { type: Number, default: 20, min: 0, max: 100 },
    organizerFee: { type: Number, default: 0, min: 0 },
    racingRewardPool: { type: Number, default: 0, min: 0 },
    spectatorRewardPool: { type: Number, default: 0, min: 0 },
    ownerReward: { type: Number, default: 0, min: 0 },
    jockeyReward: { type: Number, default: 0, min: 0 },
    racingRewards: { type: [RacingRewardSchema], default: [] },
    jackpotAmount: { type: Number, default: 0, min: 0 },
    contributorCount: { type: Number, default: 0, min: 0 },
    totalWinnerScore: { type: Number, default: 0, min: 0 },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PredictionPoolSchema.index({ tournamentId: 1, status: 1 });

export const PredictionPool = mongoose.model<IPredictionPool>(
  'PredictionPool',
  PredictionPoolSchema,
);
