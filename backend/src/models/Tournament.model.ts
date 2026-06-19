import mongoose, { Schema } from 'mongoose';
import type { PoolRolloverPolicy, TournamentStatus } from '../types/shared.types.js';
import { POOL_ROLLOVER_POLICIES } from '../types/shared.types.js';

export interface IPredictionConfig {
  isEnabled: boolean;
  pointsPerCorrect: number;
  bonusPointsTop3: number;
  predictionOpenAt?: Date | null;
  predictionCloseAt?: Date | null;
  maxPredictionsPerRace: number;
  poolEnabled: boolean;
  entryFee: number;
  minRiskMultiplier: number;
  maxRiskMultiplier: number;
  quickRiskMultipliers: number[];
  feePercent: number;
  organizerFeeRate: number;
  racingRewardRate: number;
  spectatorRewardRate: number;
  ownerShareRate: number;
  jockeyShareRate: number;
  rankRewardRates: number[];
  rolloverPolicy: PoolRolloverPolicy;
  minScoreToShare: number;
}

export interface ITournament {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location: string;
  regulationsUrl?: string;
  status: TournamentStatus;
  prizePool?: number;
  predictionConfig: IPredictionConfig;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PredictionConfigSchema = new Schema<IPredictionConfig>(
  {
    isEnabled: { type: Boolean, default: true },
    pointsPerCorrect: { type: Number, default: 100, min: 0 },
    bonusPointsTop3: { type: Number, default: 50, min: 0 },
    predictionOpenAt: { type: Date, default: null },
    predictionCloseAt: { type: Date, default: null },
    maxPredictionsPerRace: { type: Number, default: 1, min: 1, max: 5 },
    poolEnabled: { type: Boolean, default: false },
    entryFee: { type: Number, default: 100, min: 100 },
    minRiskMultiplier: { type: Number, default: 1, min: 1 },
    maxRiskMultiplier: { type: Number, default: 10, min: 1 },
    quickRiskMultipliers: {
      type: [Number],
      default: () => [1, 2, 3, 6],
      validate: {
        validator(multipliers: number[]) {
          return multipliers.every((multiplier) => Number.isInteger(multiplier) && multiplier >= 1);
        },
        message: 'quickRiskMultipliers must contain positive integers',
      },
    },
    feePercent: { type: Number, default: 10, min: 0, max: 30 },
    organizerFeeRate: { type: Number, default: 10, min: 0, max: 100 },
    racingRewardRate: { type: Number, default: 15, min: 0, max: 100 },
    spectatorRewardRate: { type: Number, default: 75, min: 0, max: 100 },
    ownerShareRate: { type: Number, default: 80, min: 0, max: 100 },
    jockeyShareRate: { type: Number, default: 20, min: 0, max: 100 },
    rankRewardRates: {
      type: [Number],
      default: () => [50, 25, 15, 7, 3],
      validate: {
        validator(rates: number[]) {
          return rates.length > 0 && rates.every((rate) => rate >= 0);
        },
        message: 'rankRewardRates must contain non-negative numbers',
      },
    },
    rolloverPolicy: {
      type: String,
      enum: POOL_ROLLOVER_POLICIES,
      default: 'to_organizer',
    },
    minScoreToShare: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

const TournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    regulationsUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'ongoing', 'completed'],
      default: 'draft',
    },
    prizePool: { type: Number, min: 0, default: 0 },
    predictionConfig: { type: PredictionConfigSchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

TournamentSchema.pre('save', function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('endDate must be after startDate'));
  }
  const cfg = this.predictionConfig;
  if (cfg.minRiskMultiplier > cfg.maxRiskMultiplier) {
    return next(new Error('minRiskMultiplier must be less than or equal to maxRiskMultiplier'));
  }
  if (
    cfg.quickRiskMultipliers.some(
      (multiplier) =>
        multiplier < cfg.minRiskMultiplier || multiplier > cfg.maxRiskMultiplier,
    )
  ) {
    return next(new Error('quickRiskMultipliers must be inside min/max risk bounds'));
  }
  const poolRateTotal =
    cfg.organizerFeeRate + cfg.racingRewardRate + cfg.spectatorRewardRate;
  if (poolRateTotal !== 100) {
    return next(new Error('Prediction pool rates must sum to 100'));
  }
  if (cfg.ownerShareRate + cfg.jockeyShareRate !== 100) {
    return next(new Error('Owner and jockey share rates must sum to 100'));
  }
  const rankTotal = cfg.rankRewardRates.reduce((sum, rate) => sum + rate, 0);
  if (rankTotal !== 100) {
    return next(new Error('Rank reward rates must sum to 100'));
  }
  if (cfg.predictionOpenAt && cfg.predictionCloseAt) {
    if (cfg.predictionCloseAt <= cfg.predictionOpenAt) {
      return next(new Error('predictionCloseAt must be after predictionOpenAt'));
    }
  }
  next();
});

TournamentSchema.index({ status: 1 });
TournamentSchema.index({ startDate: 1, endDate: 1 });
TournamentSchema.index({ createdBy: 1 });

export const Tournament = mongoose.model<ITournament>('Tournament', TournamentSchema);
