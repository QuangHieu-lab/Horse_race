import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createTournament,
  getTournamentById,
  listTournaments,
  updateTournamentStatus,
} from '../services/tournament.service.js';

export class TournamentController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await createTournament(req.user!.id, req.body);
    res.status(201).json({ tournament });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const result = await listTournaments(page, limit);
    res.json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await getTournamentById(String(req.params.id));
    res.json({ tournament });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await updateTournamentStatus(
      String(req.params.id),
      req.body.status,
    );
    res.json({ tournament });
  });
}
