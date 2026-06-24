import mongoose, { Schema } from 'mongoose';
import type { PredictionStatus } from '../types/shared.types.js';

export interface IPredictedRank {
  rank: number;
  horseId: mongoose.Types.ObjectId;
}

export interface IPrediction {
  spectatorId: mongoose.Types.ObjectId;
  raceId: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  predictedRanks: IPredictedRank[];
  status: PredictionStatus;
  riskMultiplier: number;
  contribution: number;
  poolShare: number;
  scoringWeight: number;
  pointsEarned: number;
  bonusPoints: number;
  totalPoints: number;
  evaluatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PredictedRankSchema = new Schema<IPredictedRank>(
  {
    rank: { type: Number, required: true, min: 1 },
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
  },
  { _id: false },
);

const PredictionSchema = new Schema<IPrediction>(
  {
    spectatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    predictedRanks: {
      type: [PredictedRankSchema],
      required: true,
      validate: {
        validator(ranks: IPredictedRank[]) {
          const rankNums = ranks.map((r) => r.rank);
          const horseIds = ranks.map((r) => r.horseId.toString());
          return (
            new Set(rankNums).size === rankNums.length &&
            new Set(horseIds).size === horseIds.length
          );
        },
        message: 'predictedRanks must have unique ranks and unique horses',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'correct', 'incorrect', 'cancelled'],
      default: 'pending',
    },
    riskMultiplier: { type: Number, default: 1, min: 1 },
    contribution: { type: Number, default: 0, min: 0 },
    poolShare: { type: Number, default: 0, min: 0 },
    scoringWeight: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    bonusPoints: { type: Number, default: 0, min: 0 },
    totalPoints: { type: Number, default: 0, min: 0 },
    evaluatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PredictionSchema.pre('save', function (next) {
  this.totalPoints = this.pointsEarned + this.bonusPoints + this.poolShare;
  next();
});

PredictionSchema.index({ spectatorId: 1, raceId: 1 }, { unique: true });
PredictionSchema.index({ raceId: 1 });
PredictionSchema.index({ tournamentId: 1 });
PredictionSchema.index({ spectatorId: 1, tournamentId: 1 });
PredictionSchema.index({ status: 1 });
PredictionSchema.index({ spectatorId: 1, status: 1 });

export const Prediction = mongoose.model<IPrediction>('Prediction', PredictionSchema);
