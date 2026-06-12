import mongoose, { Schema } from 'mongoose';
import type { PenaltyApplied, ProtestStatus, ViolationType } from '../types/shared.types.js';
import { PENALTY_APPLIED } from '../types/shared.types.js';
import { Race } from './Race.model.js';
import {
  disqualifiedHorseIdsFromViolations,
  validateRankings,
} from '../utils/result-rankings.js';

export interface IRanking {
  rank: number;
  horseId: mongoose.Types.ObjectId;
  jockeyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  finishTime?: number;
  marginBehind?: number;
  isDeadHeat?: boolean;
  prize: number;
}

export interface IViolation {
  horseId: mongoose.Types.ObjectId;
  type: ViolationType;
  description: string;
  penaltyApplied?: PenaltyApplied;
  recordedAt: Date;
}

export interface IProtest {
  filedBy: mongoose.Types.ObjectId;
  reason: string;
  status: ProtestStatus;
  filedAt: Date;
  resolvedAt?: Date | null;
  resolutionNote?: string;
}

export interface IResult {
  raceId: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  rankings: IRanking[];
  violations: IViolation[];
  protests: IProtest[];
  isPhotoFinish: boolean;
  confirmedBy?: mongoose.Types.ObjectId | null;
  confirmedAt?: Date | null;
  publishedBy?: mongoose.Types.ObjectId | null;
  publishedAt?: Date | null;
  reportUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RankingSchema = new Schema<IRanking>(
  {
    rank: { type: Number, required: true, min: 1 },
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    jockeyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    finishTime: { type: Number, min: 0 },
    marginBehind: { type: Number, min: 0 },
    isDeadHeat: { type: Boolean, default: false },
    prize: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const ViolationSchema = new Schema<IViolation>(
  {
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    type: {
      type: String,
      enum: ['false_start', 'obstruction', 'doping', 'other'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    penaltyApplied: { type: String, enum: PENALTY_APPLIED, default: null },
    recordedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ProtestSchema = new Schema<IProtest>(
  {
    filedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'upheld', 'dismissed'],
      default: 'pending',
    },
    filedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, trim: true },
  },
  { _id: true },
);

const ResultSchema = new Schema<IResult>(
  {
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true, unique: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    rankings: { type: [RankingSchema], default: [] },
    violations: { type: [ViolationSchema], default: [] },
    protests: { type: [ProtestSchema], default: [] },
    isPhotoFinish: { type: Boolean, default: false },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    reportUrl: { type: String, default: null },
  },
  { timestamps: true },
);

ResultSchema.virtual('isConfirmed').get(function () {
  return !!this.confirmedAt;
});

ResultSchema.virtual('isPublished').get(function () {
  return !!this.publishedAt;
});

ResultSchema.virtual('hasOpenProtest').get(function () {
  return this.protests.some((p) => p.status === 'pending');
});

ResultSchema.set('toJSON', { virtuals: true });
ResultSchema.set('toObject', { virtuals: true });

ResultSchema.pre('save', async function (next) {
  const race = await Race.findById(this.raceId);
  if (!race) return next(new Error('Race not found for result'));

  if (this.rankings.length > 0 && !['ongoing', 'completed'].includes(race.status)) {
    return next(new Error('Rankings can only be set when race is ongoing or completed'));
  }

  if (this.isModified('confirmedAt') && this.confirmedAt) {
    if (race.status !== 'completed') {
      return next(new Error('Result can only be confirmed after race is completed'));
    }
    if (this.protests.some((p) => p.status === 'pending')) {
      return next(new Error('Cannot confirm result while a protest is pending'));
    }
  }

  if (this.isModified('publishedAt') && this.publishedAt) {
    if (!this.confirmedAt) return next(new Error('Result must be confirmed before publish'));
    try {
      const { scorePredictionsFromResult } = await import(
        '../services/prediction-scoring.service.js'
      );
      await scorePredictionsFromResult(this);
    } catch (err) {
      return next(err instanceof Error ? err : new Error(String(err)));
    }
  }

  const dq = disqualifiedHorseIdsFromViolations(this.violations);
  const rankingErr = validateRankings(this.rankings, race.participants, dq);
  if (rankingErr) return next(new Error(rankingErr));

  next();
});

ResultSchema.index({ tournamentId: 1 });
ResultSchema.index({ confirmedAt: 1 });
ResultSchema.index({ publishedAt: 1 });
ResultSchema.index({ 'rankings.horseId': 1 });
ResultSchema.index({ 'rankings.jockeyId': 1 });

export const Result = mongoose.model<IResult>('Result', ResultSchema);
