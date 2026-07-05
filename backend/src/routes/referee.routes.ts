import { Router } from 'express';
import { RefereeController } from '../controllers/referee.controller.js';

export const refereeRouter = Router();
const refereeController = new RefereeController();

refereeRouter.get('/dashboard', refereeController.getDashboard);
refereeRouter.get('/races', refereeController.listRaces);
refereeRouter.get('/races/:id/checks', refereeController.listChecks);
refereeRouter.patch('/races/:id/checks', refereeController.toggleCheck);


refereeRouter.get('/violation-rules', refereeController.listViolationRules);

refereeRouter.post('/races/:id/start', refereeController.startRace);
refereeRouter.post('/races/:id/start-simulation', refereeController.startSimulation);
refereeRouter.get('/races/:id/result', refereeController.getResult);
refereeRouter.get('/races/:id/violations', refereeController.listRaceViolations);
refereeRouter.post('/races/:id/penalize', refereeController.penalize);
refereeRouter.delete('/races/:id/penalties/:violationId', refereeController.revokePenalty);
refereeRouter.post('/races/:id/result', refereeController.upsertResult);
refereeRouter.patch('/races/:id/result/confirm', refereeController.confirmResult);

