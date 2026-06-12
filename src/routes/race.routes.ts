import { Router } from 'express';
import { RaceController } from '../controllers/race.controller.js';

export const raceRouter = Router();
const raceController = new RaceController();

raceRouter.post('/', raceController.create);

raceRouter.get('/tournament/:tournamentId', raceController.getByTournament);

raceRouter.get('/:id', raceController.getById);

raceRouter.post('/:id/participants', raceController.addParticipant);

raceRouter.patch('/:id/status', raceController.updateStatus);

raceRouter.delete('/:id', raceController.delete);