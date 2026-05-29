import { Router } from 'express';
import { AdminJobsController } from '../controllers/admin-jobs.controller.js';

export const adminJobsRouter = Router();
const controller = new AdminJobsController();

adminJobsRouter.post('/viewing-ticket-reminders', controller.viewingTicketReminders);
