import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';

export const adminRouter = Router();
const adminController = new AdminController();

adminRouter.get('/users', adminController.listUsers);
adminRouter.get('/registrations', adminController.listRegistrations);
adminRouter.patch('/registrations/:id', adminController.updateRegistration);
adminRouter.patch('/races/:id/result/publish', adminController.publishResult);
adminRouter.get('/results/publish-queue', adminController.listPublishQueue);
