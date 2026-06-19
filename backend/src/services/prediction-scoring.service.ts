import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Prediction } from '../models/Prediction.model.js';
import { Race } from '../models/Race.model.js';
import type { IResult } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { Tournament } from '../models/Tournament.model.js';
import type { PredictionStatus } from '../types/shared.types.js';
import { settlePredictionPoolFromResult } from './prediction-pool.service.js';

function evaluatePrediction(
  predictedRanks: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
  actualRankings: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
): { correctCount: number; totalPredicted: number; top3Bonus: boolean } {
  const actualMap = new Map(
    actualRankings.map((r) => [r.horseId.toString(), r.rank]),
  );

  let correctCount = 0;
  for (const pred of predictedRanks) {
    const actualRank = actualMap.get(pred.horseId.toString());
    if (actualRank === pred.rank) correctCount++;
  }

  const top3Bonus =
    predictedRanks.length >= 3 &&
    predictedRanks
      .filter((p) => p.rank <= 3)
      .every((p) => actualMap.get(p.horseId.toString()) === p.rank);

  return {
    correctCount,
    totalPredicted: predictedRanks.length,
    top3Bonus,
  };
}

function resolveStatus(correctCount: number, totalPredicted: number): PredictionStatus {
  if (correctCount === 0) return 'incorrect';
  if (correctCount === totalPredicted) return 'correct';
  return 'partial';
}

function predictsWinner(
  predictedRanks: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
  actualRankings: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
): boolean {
  const predictedWinner = predictedRanks.find((prediction) => prediction.rank === 1);
  if (!predictedWinner) return false;
  return actualRankings.some(
    (ranking) =>
      ranking.rank === 1 && ranking.horseId.toString() === predictedWinner.horseId.toString(),
  );
}

export async function scorePredictionsForRace(raceId: mongoose.Types.ObjectId): Promise<void> {
  const { Result } = await import('../models/Result.model.js');
  const result = await Result.findOne({ raceId, publishedAt: { $ne: null } }).lean();
  if (!result) return;
  await scorePredictionsFromResult(result);
}

export async function scorePredictionsFromResult(
  result: Pick<IResult, 'raceId' | 'tournamentId' | 'rankings' | 'publishedBy'>,
): Promise<void> {
  const raceId = result.raceId;
  const race = await Race.findById(raceId).lean();
  if (!race) return;

  const tournament = await Tournament.findById(race.tournamentId).lean();
  if (!tournament) return;

  const predictions = await Prediction.find({
    raceId,
    status: 'pending',
  });

  const { pointsPerCorrect, bonusPointsTop3 } = tournament.predictionConfig;
  const actualRankings = result.rankings.map((r) => ({
    rank: r.rank,
    horseId: r.horseId,
  }));

  if (tournament.predictionConfig.poolEnabled) {
    for (const prediction of predictions) {
      const isWinner = predictsWinner(prediction.predictedRanks, actualRankings);
      prediction.status = isWinner ? 'correct' : 'incorrect';
      prediction.scoringWeight = isWinner ? 1 : 0;
      prediction.pointsEarned = 0;
      prediction.bonusPoints = 0;
      prediction.poolShare = 0;
      prediction.totalPoints = 0;
      prediction.evaluatedAt = new Date();
      await prediction.save();
    }

    await settlePredictionPoolFromResult(result);
    return;
  }

  for (const prediction of predictions) {
    const { correctCount, totalPredicted, top3Bonus } = evaluatePrediction(
      prediction.predictedRanks,
      actualRankings,
    );

    const pointsEarned = correctCount * pointsPerCorrect;
    const bonusPoints = top3Bonus ? bonusPointsTop3 : 0;
    const totalPoints = pointsEarned + bonusPoints;

    prediction.status = resolveStatus(correctCount, totalPredicted);
    prediction.pointsEarned = pointsEarned;
    prediction.bonusPoints = bonusPoints;
    prediction.totalPoints = totalPoints;
    prediction.evaluatedAt = new Date();
    await prediction.save();

    if (totalPoints > 0) {
      let profile = await SpectatorProfile.findOne({ userId: prediction.spectatorId });
      if (!profile) {
        profile = await SpectatorProfile.create({ userId: prediction.spectatorId });
      }

      if (pointsEarned > 0) {
        await profile.addPoints(
          pointsEarned,
          'earned_prediction',
          'Prediction',
          prediction._id,
          `Dự đoán cuộc đua ${race.name}`,
        );
      }
      if (bonusPoints > 0) {
        profile = await SpectatorProfile.findOne({ userId: prediction.spectatorId });
        if (profile) {
          await profile.addPoints(
            bonusPoints,
            'earned_bonus',
            'Prediction',
            prediction._id,
            `Bonus top 3 — ${race.name}`,
          );
        }
      }

      await Notification.create({
        userId: prediction.spectatorId,
        type: 'prediction_reward',
        title: 'Thưởng dự đoán',
        message: `Bạn nhận ${totalPoints} điểm từ dự đoán cuộc đua ${race.name}.`,
        refModel: 'Prediction',
        refId: prediction._id,
      });
    }
  }

  await settlePredictionPoolFromResult(result);
}
