import mongoose, { Schema } from 'mongoose';
import type { ViewingPassSource, ViewingPassStatus } from '../types/shared.types.js';

export interface IRaceViewingPass {
  spectatorId: mongoose.Types.ObjectId;
  raceId: mongoose.Types.ObjectId;
  source: ViewingPassSource;
  pointsPaid: number;
  purchasedAt: Date;
  status: ViewingPassStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RaceViewingPassSchema = new Schema<IRaceViewingPass>(
  {
    spectatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true },
    source: {
      type: String,
      enum: ['purchase', 'vip_redemption'],
      required: true,
    },
    pointsPaid: { type: Number, required: true, min: 0, default: 0 },
    purchasedAt: { type: Date, default: () => new Date() },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
    },
  },
  { timestamps: true },
);

RaceViewingPassSchema.index({ spectatorId: 1, raceId: 1 }, { unique: true });
RaceViewingPassSchema.index({ raceId: 1, status: 1 });
RaceViewingPassSchema.index({ spectatorId: 1, status: 1 });

export const RaceViewingPass = mongoose.model<IRaceViewingPass>(
  'RaceViewingPass',
  RaceViewingPassSchema,
);
