import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { cancelPrediction, createPrediction } from '../services/prediction.service.js';
import * as paymentService from '../services/payment.service.js';
import * as spectatorService from '../services/spectator.service.js';
import * as viewingTicketService from '../services/viewing-ticket.service.js';
import { listNotificationsForUser } from '../services/notification.service.js';
import { HttpError } from '../utils/http-error.js';

export class SpectatorController {
  listTournaments = asyncHandler(async (_req: Request, res: Response) => {
    const tournaments = await spectatorService.listTournaments();
    res.json({ tournaments });
  });

  listRaces = asyncHandler(async (req: Request, res: Response) => {
    const filter = req.query.filter as 'open' | 'upcoming' | 'completed' | undefined;
    const validFilters = ['open', 'upcoming', 'completed'];
    if (filter && !validFilters.includes(filter)) {
      throw new HttpError(400, 'filter không hợp lệ');
    }
    const races = await spectatorService.listSpectatorRaces(req.user!.id, filter);
    res.json({ races });
  });

  getRaceById = asyncHandler(async (req: Request, res: Response) => {
    const race = await spectatorService.getSpectatorRace(req.user!.id, req.params.id as string);
    res.json({ race });
  });

  listPredictions = asyncHandler(async (req: Request, res: Response) => {
    const predictions = await spectatorService.listPredictions(req.user!.id);
    res.json({ predictions });
  });

  createPrediction = asyncHandler(async (req: Request, res: Response) => {
    const { raceId, predictedRanks, ticketCount, riskMultiplier } = req.body as {
      raceId?: string;
      predictedRanks?: Array<{ rank: number; horseId: string }>;
      ticketCount?: number;
      riskMultiplier?: number;
    };
    if (!raceId || !predictedRanks) {
      throw new HttpError(400, 'raceId và predictedRanks là bắt buộc');
    }
    const prediction = await createPrediction(req.user!.id, {
      raceId,
      predictedRanks,
      ticketCount,
      riskMultiplier,
    });
    res.status(201).json({ prediction });
  });

  cancelPrediction = asyncHandler(async (req: Request, res: Response) => {
    const result = await cancelPrediction(req.user!.id, req.params.id as string);
    res.json(result);
  });

  getPoints = asyncHandler(async (req: Request, res: Response) => {
    const points = await spectatorService.getOrCreateProfile(req.user!.id);
    res.json({ points });
  });

  createTopUp = asyncHandler(async (req: Request, res: Response) => {
    const { points } = req.body as { points?: number };
    if (points === undefined) {
      throw new HttpError(400, 'points là bắt buộc');
    }
    const result = await paymentService.createMockTopUp(req.user!.id, points);
    res.status(201).json(result);
  });

  createPayosTopUp = asyncHandler(async (req: Request, res: Response) => {
    const { points } = req.body as { points?: number };
    if (points === undefined) {
      throw new HttpError(400, 'points là bắt buộc');
    }
    const result = await paymentService.createPayosTopUp(req.user!.id, points);
    res.status(201).json(result);
  });

  listTopUps = asyncHandler(async (req: Request, res: Response) => {
    const payments = await paymentService.listTopUps(req.user!.id);
    res.json({ payments });
  });

  listProducts = asyncHandler(async (_req: Request, res: Response) => {
    const products = await spectatorService.listProducts();
    res.json({ products });
  });

  createRedemption = asyncHandler(async (req: Request, res: Response) => {
    const { productId, quantity } = req.body as { productId?: string; quantity?: number };
    if (!productId) throw new HttpError(400, 'productId là bắt buộc');
    const result = await spectatorService.redeemProduct(
      req.user!.id,
      productId,
      quantity ?? 1,
    );
    res.status(201).json(result);
  });

  purchaseViewingPass = asyncHandler(async (req: Request, res: Response) => {
    const result = await viewingTicketService.purchaseViewingPass(
      req.user!.id,
      req.params.id as string,
    );
    res.status(201).json(result);
  });

  listViewingPasses = asyncHandler(async (req: Request, res: Response) => {
    const filter = req.query.filter as 'upcoming' | undefined;
    if (filter && filter !== 'upcoming') {
      throw new HttpError(400, 'filter không hợp lệ');
    }
    const passes = await viewingTicketService.listViewingPasses(req.user!.id, filter);
    res.json({ passes });
  });

  listNotifications = asyncHandler(async (req: Request, res: Response) => {
    const notifications = await listNotificationsForUser(req.user!.id);
    res.json({ notifications });
  });

  getRaceSimulation = asyncHandler(async (req: Request, res: Response) => {
    const data = await spectatorService.getRaceSimulation(req.params.id as string);
    res.json(data);
  });
}
