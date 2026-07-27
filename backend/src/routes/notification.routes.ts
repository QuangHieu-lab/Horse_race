import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';

export const notificationRouter = Router();
const notificationController = new NotificationController();

notificationRouter.post('/device-token', notificationController.registerDeviceToken);
notificationRouter.delete('/device-token', notificationController.unregisterDeviceToken);
notificationRouter.patch('/read-all', notificationController.markAllRead);
notificationRouter.patch('/:id/read', notificationController.markRead);
