import { Router } from 'express';
import { SpectatorController } from '../controllers/spectator.controller.js';

export const spectatorRouter = Router();
const spectatorController = new SpectatorController();

spectatorRouter.get('/tournaments', spectatorController.listTournaments);

spectatorRouter.get('/races', spectatorController.listRaces);

spectatorRouter.get('/races/:id', spectatorController.getRaceById);

spectatorRouter.get('/predictions', spectatorController.listPredictions);

spectatorRouter.post('/predictions', spectatorController.createPrediction);

spectatorRouter.get('/points', spectatorController.getPoints);

spectatorRouter.get('/products', spectatorController.listProducts);

spectatorRouter.post('/redemptions', spectatorController.createRedemption);
