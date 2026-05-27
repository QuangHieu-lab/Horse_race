import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createTournament,
  getTournamentById,
  listTournaments,
  updateTournamentStatus,
} from '../services/tournament.service.js';

export const tournamentRouter = Router();

tournamentRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const tournament = await createTournament(req.user!.id, req.body);
    res.status(201).json({ tournament });
  }),
);

tournamentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const result = await listTournaments(page, limit);
    res.json(result);
  }),
);

tournamentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tournament = await getTournamentById(String(req.params.id));
    res.json({ tournament });
  }),
);

tournamentRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const status = req.body.status;
    const tournament = await updateTournamentStatus(String(req.params.id), status);
    res.json({ tournament });
  }),
);
