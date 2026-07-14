import { Router } from 'express';
import { TournamentController } from '../controllers/tournament.controller.js';

export const tournamentRouter = Router();
const tournamentController = new TournamentController();

tournamentRouter.post('/', tournamentController.create);

tournamentRouter.get('/', tournamentController.getAll);

tournamentRouter.get('/:id', tournamentController.getById);

tournamentRouter.patch('/:id/status', tournamentController.updateStatus);

tournamentRouter.patch('/:id/prize-pool', tournamentController.updatePrizePool);

tournamentRouter.patch('/:id/prediction-config', tournamentController.updatePredictionConfig);

tournamentRouter.delete('/:id', tournamentController.delete);
