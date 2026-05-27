import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  addParticipantToRace,
  createRace,
  getRaceById,
  getRacesByTournament,
  updateRaceStatus,
} from '../services/race.service.js';

export const raceRouter = Router();

raceRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const race = await createRace(req.body);
    res.status(201).json({ race });
  }),
);

raceRouter.get(
  '/tournament/:tournamentId',
  asyncHandler(async (req, res) => {
    const races = await getRacesByTournament(String(req.params.tournamentId));
    res.json({ races });
  }),
);

raceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const race = await getRaceById(String(req.params.id));
    res.json({ race });
  }),
);

raceRouter.post(
  '/:id/participants',
  asyncHandler(async (req, res) => {
    const race = await addParticipantToRace(String(req.params.id), req.body);
    res.json({ race });
  }),
);

raceRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const race = await updateRaceStatus(String(req.params.id), req.body.status);
    res.json({ race });
  }),
);
