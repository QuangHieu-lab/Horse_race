import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';

export const adminRouter = Router();
const adminController = new AdminController();

adminRouter.get('/jockey-applications', adminController.listJockeyApplications);
adminRouter.patch('/jockey-applications/:id', adminController.reviewJockeyApplication);
adminRouter.get('/owner-applications', adminController.listOwnerApplications);
adminRouter.patch('/owner-applications/:id', adminController.reviewOwnerApplication);
adminRouter.get('/users', adminController.listUsers);
adminRouter.post('/users', adminController.createUser);
adminRouter.patch('/users/:id', adminController.updateUser);
adminRouter.delete('/users/:id', adminController.deleteUser);
adminRouter.get('/registrations', adminController.listRegistrations);
adminRouter.patch('/registrations/:id', adminController.updateRegistration);
adminRouter.patch('/races/:id/result/publish', adminController.publishResult);
adminRouter.get('/results/publish-queue', adminController.listPublishQueue);
