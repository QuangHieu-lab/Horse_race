import mongoose, { Schema } from 'mongoose';
import type { PredictionPoolStatus } from '../types/shared.types.js';

export interface IPredictionPool {
  raceId: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  status: PredictionPoolStatus;
  ticketPrice: number;
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
  jackpotAmount: number;
  contributorCount: number;
  totalWinnerScore: number;
  settledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
