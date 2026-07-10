import { Router } from 'express';
import { JockeyController } from '../controllers/jockey.controller.js';

export const jockeyRouter = Router();
const jockeyController = new JockeyController();

jockeyRouter.get('/dashboard', jockeyController.dashboard);

jockeyRouter.get('/invitations', jockeyController.listInvitations);

jockeyRouter.patch('/invitations/:id', jockeyController.respondInvitation);

jockeyRouter.get('/races', jockeyController.listRaces);

jockeyRouter.get('/races/:id', jockeyController.getRaceById);

jockeyRouter.get('/notifications', jockeyController.listNotifications);

jockeyRouter.get('/penalty-detail', jockeyController.getPenaltyDetail);
