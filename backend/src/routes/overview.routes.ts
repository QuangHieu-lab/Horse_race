import { Router } from 'express';
import { OverviewController } from '../controllers/overview.controller.js';

export const overviewRouter = Router();
const overviewController = new OverviewController();

overviewRouter.get('/sidebar', overviewController.getSidebar);
