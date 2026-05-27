import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { createPrediction } from '../services/prediction.service.js';
import * as spectatorService from '../services/spectator.service.js';
import { HttpError } from '../utils/http-error.js';

export const spectatorRouter = Router();

spectatorRouter.get(
  '/tournaments',
  asyncHandler(async (_req, res) => {
    const tournaments = await spectatorService.listTournaments();
    res.json({ tournaments });
  }),
);

spectatorRouter.get(
  '/races',
  asyncHandler(async (req, res) => {
    const filter = req.query.filter as 'open' | 'upcoming' | 'completed' | undefined;
    const validFilters = ['open', 'upcoming', 'completed'];
    if (filter && !validFilters.includes(filter)) {
      throw new HttpError(400, 'filter không hợp lệ');
    }
    const races = await spectatorService.listSpectatorRaces(req.user!.id, filter);
    res.json({ races });
  }),
);

spectatorRouter.get(
  '/races/:id',
  asyncHandler(async (req, res) => {
    const race = await spectatorService.getSpectatorRace(req.user!.id, req.params.id as string);
    res.json({ race });
  }),
);

spectatorRouter.get(
  '/predictions',
  asyncHandler(async (req, res) => {
    const predictions = await spectatorService.listPredictions(req.user!.id);
    res.json({ predictions });
  }),
);

spectatorRouter.post(
  '/predictions',
  asyncHandler(async (req, res) => {
    const { raceId, predictedRanks } = req.body as {
      raceId?: string;
      predictedRanks?: Array<{ rank: number; horseId: string }>;
    };
    if (!raceId || !predictedRanks) {
      throw new HttpError(400, 'raceId và predictedRanks là bắt buộc');
    }
    const prediction = await createPrediction(req.user!.id, { raceId, predictedRanks });
    res.status(201).json({ prediction });
  }),
);

spectatorRouter.get(
  '/points',
  asyncHandler(async (req, res) => {
    const points = await spectatorService.getOrCreateProfile(req.user!.id);
    res.json({ points });
  }),
);

spectatorRouter.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await spectatorService.listProducts();
    res.json({ products });
  }),
);

spectatorRouter.post(
  '/redemptions',
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body as { productId?: string; quantity?: number };
    if (!productId) throw new HttpError(400, 'productId là bắt buộc');
    const result = await spectatorService.redeemProduct(
      req.user!.id,
      productId,
      quantity ?? 1,
    );
    res.status(201).json(result);
  }),
);
