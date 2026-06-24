import { Router } from 'express';
import { RefereeController } from '../controllers/referee.controller.js';

export const refereeRouter = Router();
const refereeController = new RefereeController();

refereeRouter.get('/dashboard', refereeController.getDashboard);
refereeRouter.get('/races', refereeController.listRaces);
refereeRouter.get('/races/:id/checks', refereeController.listChecks);
refereeRouter.patch('/races/:id/checks', refereeController.toggleCheck);


refereeRouter.post('/races/:id/start-simulation', refereeController.startSimulation);
refereeRouter.get('/races/:id/result', refereeController.getResult);
refereeRouter.post('/races/:id/penalize', refereeController.penalize);
refereeRouter.post('/races/:id/result', refereeController.upsertResult);
refereeRouter.post('/races/:id/penalties/time', refereeController.applyTimePenalty); // <-- Thêm API phạt thời gian vào đây
refereeRouter.patch('/races/:id/result/confirm', refereeController.confirmResult);

