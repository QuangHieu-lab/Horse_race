import { Router } from 'express';
import { SpectatorController } from '../controllers/spectator.controller.js';

export const spectatorRouter = Router();
const spectatorController = new SpectatorController();

spectatorRouter.get('/tournaments', spectatorController.listTournaments);

spectatorRouter.get('/races', spectatorController.listRaces);

spectatorRouter.get('/races/:id', spectatorController.getRaceById);

spectatorRouter.get('/races/:id/simulation', spectatorController.getRaceSimulation);

spectatorRouter.get('/races/:id/replay', spectatorController.getRaceReplay);

spectatorRouter.post('/races/:id/viewing-pass', spectatorController.purchaseViewingPass);

spectatorRouter.get('/viewing-passes', spectatorController.listViewingPasses);

spectatorRouter.get('/predictions/current', spectatorController.listPredictions);

spectatorRouter.get('/predictions/:id', spectatorController.listPredictions);

spectatorRouter.post('/predictions/:id', spectatorController.createPrediction);

spectatorRouter.patch('/predictions/:id/cancel', spectatorController.cancelPrediction);

spectatorRouter.get('/points', spectatorController.getPoints);

spectatorRouter.post('/top-ups', spectatorController.createTopUp);

spectatorRouter.post('/top-ups/payos', spectatorController.createPayosTopUp);

spectatorRouter.get('/top-ups', spectatorController.listTopUps);

spectatorRouter.get('/products', spectatorController.listProducts);

spectatorRouter.post('/redemptions', spectatorController.createRedemption);

spectatorRouter.get('/notifications', spectatorController.listNotifications);
