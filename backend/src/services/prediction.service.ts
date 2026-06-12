import mongoose from 'mongoose';
import { Prediction } from '../models/Prediction.model.js';
import { Race } from '../models/Race.model.js';
import { Tournament } from '../models/Tournament.model.js';
import type { PredictionDto } from '../types/api.types.js';
import { HttpError } from '../utils/http-error.js';
import { chargePredictionTicket } from './prediction-pool.service.js';
import { isPredictionWindowOpen } from './spectator.service.js';
import { listPredictions } from './spectator.service.js';

export interface CreatePredictionInput {
  raceId: string;
  predictedRanks: Array<{ rank: number; horseId: string }>;
}

export async function createPrediction(
  spectatorId: string,
  input: CreatePredictionInput,
): Promise<PredictionDto> {
  const { raceId, predictedRanks } = input;

  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }
  if (!predictedRanks?.length) {
    throw new HttpError(400, 'Dự đoán phải có ít nhất một thứ hạng');
  }

  const rankNums = predictedRanks.map((r) => r.rank);
  const horseIds = predictedRanks.map((r) => r.horseId);
  if (new Set(rankNums).size !== rankNums.length) {
    throw new HttpError(400, 'Thứ hạng không được trùng');
  }
  if (new Set(horseIds).size !== horseIds.length) {
    throw new HttpError(400, 'Ngựa không được trùng');
  }
  for (const r of predictedRanks) {
    if (!Number.isInteger(r.rank) || r.rank < 1) {
      throw new HttpError(400, 'Thứ hạng phải là số nguyên dương');
    }
    if (!mongoose.isValidObjectId(r.horseId)) {
      throw new HttpError(400, 'ID ngựa không hợp lệ');
    }
  }

  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const tournament = await Tournament.findById(race.tournamentId).lean();
  if (!tournament) throw new HttpError(500, 'Không tìm thấy giải đấu');

  if (!isPredictionWindowOpen(race, tournament)) {
    throw new HttpError(409, 'Cửa sổ dự đoán đã đóng hoặc chưa mở');
  }

  const participantHorseIds = new Set(race.participants.map((p) => p.horseId.toString()));
  for (const r of predictedRanks) {
    if (!participantHorseIds.has(r.horseId)) {
      throw new HttpError(400, 'Ngựa không tham gia cuộc đua này');
    }
  }

  const maxRank = Math.max(...rankNums);
  if (maxRank > race.participants.length) {
    throw new HttpError(400, 'Thứ hạng vượt quá số ngựa thi đấu');
  }

  const existing = await Prediction.findOne({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    raceId: race._id,
  });
  if (existing) {
    throw new HttpError(409, 'Bạn đã dự đoán cuộc đua này');
  }

  let contribution = 0;
  if (tournament.predictionConfig.poolEnabled) {
    const charged = await chargePredictionTicket(spectatorId, {
      _id: race._id,
      tournamentId: race.tournamentId,
      name: race.name,
      ticketPrice: tournament.predictionConfig.entryFee || undefined,
      organizerFeeRate: tournament.predictionConfig.organizerFeeRate,
      racingRewardRate: tournament.predictionConfig.racingRewardRate,
      spectatorRewardRate: tournament.predictionConfig.spectatorRewardRate,
      ownerShareRate: tournament.predictionConfig.ownerShareRate,
      jockeyShareRate: tournament.predictionConfig.jockeyShareRate,
    });
    contribution = charged.contribution;
  }

  await Prediction.create({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    raceId: race._id,
    tournamentId: race.tournamentId,
    predictedRanks: predictedRanks.map((r) => ({
      rank: r.rank,
      horseId: new mongoose.Types.ObjectId(r.horseId),
    })),
    status: 'pending',
    contribution,
  });

  const all = await listPredictions(spectatorId);
  const created = all.find((p) => p.raceId === raceId);
  if (!created) throw new HttpError(500, 'Lỗi tạo dự đoán');
  return created;
}
