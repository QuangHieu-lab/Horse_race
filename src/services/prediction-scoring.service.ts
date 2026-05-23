import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Prediction } from '../models/Prediction.model.js';
import { Result } from '../models/Result.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import type { IPredictedRank } from '../models/Prediction.model.js';
import type { IRanking } from '../models/Result.model.js';
import { ApiError } from '../utils/api-error.js';

function scorePrediction(
  predicted: IPredictedRank[],
  actual: IRanking[],
  pointsPerCorrect: number,
  bonusTop3: number,
): { pointsEarned: number; bonusPoints: number; status: 'correct' | 'partial' | 'incorrect' } {
  const actualMap = new Map(actual.map((r) => [r.rank, r.horseId.toString()]));
  let correct = 0;
  for (const p of predicted) {
    if (actualMap.get(p.rank) === p.horseId.toString()) correct++;
  }

  const pointsEarned = correct * pointsPerCorrect;
  let bonusPoints = 0;
  if (correct >= 3 && predicted.length >= 3) bonusPoints = bonusTop3;

  let status: 'correct' | 'partial' | 'incorrect' = 'incorrect';
  if (correct === predicted.length && predicted.length > 0) status = 'correct';
  else if (correct > 0) status = 'partial';

  return { pointsEarned, bonusPoints, status };
}

export async function evaluatePredictionsForRace(raceId: string): Promise<number> {
  const result = await Result.findOne({ raceId });
  if (!result?.publishedAt) {
    throw ApiError.badRequest('Result must be published before scoring predictions');
  }

  const tournament = await Tournament.findById(result.tournamentId);
  if (!tournament) throw ApiError.notFound('Tournament not found');

  const cfg = tournament.predictionConfig;
  const predictions = await Prediction.find({
    raceId,
    status: 'pending',
  });

  let evaluated = 0;
  for (const pred of predictions) {
    const { pointsEarned, bonusPoints, status } = scorePrediction(
      pred.predictedRanks,
      result.rankings,
      cfg.pointsPerCorrect,
      cfg.bonusPointsTop3,
    );

    pred.pointsEarned = pointsEarned;
    pred.bonusPoints = bonusPoints;
    pred.status = status;
    pred.evaluatedAt = new Date();
    pred.scoringWeight = pointsEarned + bonusPoints;
    await pred.save();

    const totalAward = pointsEarned + bonusPoints;
    if (totalAward > 0) {
      const profile = await SpectatorProfile.findOne({ userId: pred.spectatorId });
      if (profile) {
        await profile.addPoints(
          totalAward,
          bonusPoints > 0 ? 'earned_bonus' : 'earned_prediction',
          'Prediction',
          pred._id,
          `Prediction reward for race ${raceId}`,
        );
      }

      await Notification.create({
        userId: pred.spectatorId,
        type: 'prediction_reward',
        title: 'Thưởng dự đoán',
        message: `Bạn nhận ${totalAward} điểm từ dự đoán cuộc đua.`,
        refModel: 'Prediction',
        refId: pred._id,
      });
    }

    evaluated++;
  }

  return evaluated;
}
