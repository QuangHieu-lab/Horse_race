import type { NextFunction, Request, Response } from 'express';
import {
  markAllNotificationsRead,
  markNotificationRead,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../services/notification.service.js';
import { HttpError } from '../utils/http-error.js';

function getBodyToken(req: Request): string {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) throw new HttpError(400, 'Thiếu device token');
  return token;
}

export class NotificationController {
  registerDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = getBodyToken(req);
      const platform = req.body?.platform;
      if (platform !== 'android' && platform !== 'ios') {
        throw new HttpError(400, 'Nền tảng thiết bị không hợp lệ');
      }
      await registerDeviceToken(req.user!.id, token, platform);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  unregisterDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = getBodyToken(req);
      await unregisterDeviceToken(req.user!.id, token);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = req.params.id;
      if (typeof notificationId !== 'string') throw new HttpError(400, 'Thiếu ID thông báo');
      await markNotificationRead(req.user!.id, notificationId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await markAllNotificationsRead(req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
