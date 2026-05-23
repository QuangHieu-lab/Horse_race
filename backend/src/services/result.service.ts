import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { User } from '../models/User.model.js';
import { Notification } from '../models/Notification.model.js';
import type { IRanking, IViolation } from '../models/Result.model.js';
import { evaluatePredictionsForRace } from './prediction-scoring.service.js';
import { ApiError } from '../utils/api-error.js';

export async function upsertResult(
  raceId: string,
  refereeId: string,
  data: { rankings?: IRanking[]; violations?: IViolation[]; reportUrl?: string; isPhotoFinish?: boolean },
) {
  const race = await Race.findById(raceId);
  if (!race) throw ApiError.notFound('Race not found');
  if (race.refereeId?.toString() !== refereeId) {
    throw ApiError.forbidden('Not assigned referee for this race');
  }

  let result = await Result.findOne({ raceId });
  if (!result) {
    result = await Result.create({
      raceId: race._id,
      tournamentId: race.tournamentId,
      rankings: data.rankings ?? [],
      violations: data.violations ?? [],
      reportUrl: data.reportUrl ?? null,
      isPhotoFinish: data.isPhotoFinish ?? false,
    });
  } else {
    if (result.publishedAt) throw ApiError.conflict('Cannot edit published result');
    if (data.rankings) result.rankings = data.rankings;
    if (data.violations) result.violations = data.violations;
    if (data.reportUrl !== undefined) result.reportUrl = data.reportUrl;
    if (data.isPhotoFinish !== undefined) result.isPhotoFinish = data.isPhotoFinish;
    await result.save();
  }

  return result;
}

export async function confirmResult(raceId: string, refereeId: string) {
  const race = await Race.findById(raceId);
  if (!race) throw ApiError.notFound('Race not found');
  if (race.refereeId?.toString() !== refereeId) {
    throw ApiError.forbidden('Not assigned referee for this race');
  }

  const result = await Result.findOne({ raceId });
  if (!result) throw ApiError.notFound('Result not found');

  result.confirmedBy = new mongoose.Types.ObjectId(refereeId);
  result.confirmedAt = new Date();
  await result.save();

  const admins = await User.find({ role: 'admin', isActive: true });
  await Notification.insertMany(
    admins.map((a) => ({
      userId: a._id,
      type: 'result_confirmed' as const,
      title: 'Kết quả chờ công bố',
      message: `Trọng tài đã xác nhận kết quả ${race.name}.`,
      refModel: 'Result' as const,
      refId: result._id,
    })),
  );

  return result;
}

export async function publishResult(raceId: string, adminId: string) {
  const result = await Result.findOne({ raceId });
  if (!result) throw ApiError.notFound('Result not found');
  if (!result.confirmedAt) throw ApiError.badRequest('Result must be confirmed first');
  if (result.publishedAt) throw ApiError.conflict('Result already published');

  result.publishedBy = new mongoose.Types.ObjectId(adminId);
  result.publishedAt = new Date();
  await result.save();

  const evaluated = await evaluatePredictionsForRace(raceId);

  const race = await Race.findById(raceId);
  if (race) {
    const spectators = await User.find({ role: 'spectator', isActive: true }).limit(50);
    if (spectators.length > 0) {
      await Notification.insertMany(
        spectators.map((s) => ({
          userId: s._id,
          type: 'result_published' as const,
          title: 'Kết quả chính thức',
          message: `Kết quả ${race.name} đã được công bố.`,
          refModel: 'Result' as const,
          refId: result._id,
        })),
      );
    }
  }

  return { result, predictionsEvaluated: evaluated };
}
