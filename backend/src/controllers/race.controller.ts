import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createRace,
  getRaceById,
  getRacesByTournament,
  updateRaceStatus,
  deleteRace,
} from '../services/race.service.js';
import { addParticipant, listEligibleEntries } from '../services/race-participant.service.js';
import { simulateAndPublishRace } from '../services/race-simulation.service.js';

export class RaceController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const race = await createRace(req.body);
    res.status(201).json({ race });
  });

  getByTournament = asyncHandler(async (req: Request, res: Response) => {
    const races = await getRacesByTournament(String(req.params.tournamentId));
    res.json({ races });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const race = await getRaceById(String(req.params.id));
    res.json({ race });
  });


  eligibleEntries = asyncHandler(async (req: Request, res: Response) => {
    const entries = await listEligibleEntries(String(req.params.id));
    res.json({ entries });
  });

  addParticipant = asyncHandler(async (req: Request, res: Response) => {
    const participants = await addParticipant(String(req.params.id), req.body);
    res.status(201).json({ participants });
  });

  simulate = asyncHandler(async (req: Request, res: Response) => {
    const timeline = await simulateAndPublishRace(String(req.params.id), req.user!.id);
    res.json({ timeline });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const race = await updateRaceStatus(String(req.params.id), req.body.status);
    res.json({ race });
  });
  delete = asyncHandler(async (req: Request, res: Response) => {
    await deleteRace(String(req.params.id));
    res.json({ success: true, message: 'Đã xóa trận đua thành công' });
  });
}
