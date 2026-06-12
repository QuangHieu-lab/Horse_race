import mongoose, { Schema } from 'mongoose';
import type { PredictionPoolStatus } from '../types/shared.types.js';

export interface IPredictionPool {
  raceId: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  status: PredictionPoolStatus;
  totalContributed: number;
  feePercent: number;
  feeCollected: number;
  netPool: number;
  contributorCount: number;
  settledAt?: Date | null;
  rolloverIn: number;
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
    totalContributed: { type: Number, default: 0, min: 0 },
    feePercent: { type: Number, default: 10, min: 0, max: 30 },
    feeCollected: { type: Number, default: 0, min: 0 },
    netPool: { type: Number, default: 0, min: 0 },
    contributorCount: { type: Number, default: 0, min: 0 },
    settledAt: { type: Date, default: null },
    rolloverIn: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

PredictionPoolSchema.index({ tournamentId: 1, status: 1 });

export const PredictionPool = mongoose.model<IPredictionPool>(
  'PredictionPool',
  PredictionPoolSchema,
);
