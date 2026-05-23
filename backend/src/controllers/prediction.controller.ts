import type { Request, Response } from 'express';
import { Prediction } from '../models/Prediction.model.js';
import { Race } from '../models/Race.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { ApiError } from '../utils/api-error.js';

export async function createPrediction(req: Request, res: Response) {
  const { raceId, tournamentId, predictedRanks } = req.body ?? {};
  if (!raceId || !tournamentId || !predictedRanks?.length) {
    throw ApiError.badRequest('raceId, tournamentId, predictedRanks required');
  }

  const race = await Race.findById(raceId);
  if (!race) throw ApiError.notFound('Race not found');
  if (race.status !== 'scheduled') {
    throw ApiError.badRequest('Predictions only allowed before race starts');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament?.predictionConfig.isEnabled) {
    throw ApiError.badRequest('Predictions disabled for this tournament');
  }

  const now = new Date();
  const cfg = tournament.predictionConfig;
  const openAt = race.predictionOpenAt ?? cfg.predictionOpenAt;
  const closeAt = race.predictionCloseAt ?? cfg.predictionCloseAt;
  if (openAt && now < openAt) throw ApiError.badRequest('Prediction window not open yet');
  if (closeAt && now > closeAt) throw ApiError.badRequest('Prediction window closed');

  const pred = await Prediction.create({
    spectatorId: req.userId,
    raceId,
    tournamentId,
    predictedRanks,
    contribution: cfg.poolEnabled ? cfg.entryFee : 0,
  });

  res.status(201).json({ success: true, data: pred });
}

export async function myPredictions(req: Request, res: Response) {
  const items = await Prediction.find({ spectatorId: req.userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
}
