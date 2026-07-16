import { Router } from 'express';
import { PointsController } from '../controllers/points.controller.js';

export const pointsRouter = Router();
const pointsController = new PointsController();

pointsRouter.get('/me', pointsController.getMine);
