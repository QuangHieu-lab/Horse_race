import { Router } from 'express';
import { adminRaceMeetingController } from '../controllers/admin-racemeeting.controller.js';
// Nhớ import các middleware check Admin token của bạn vào đây
// import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export const adminRaceMeetingRouter = Router();

// Endpoint: POST /api/admin/race-meetings
adminRaceMeetingRouter.post( '/', adminRaceMeetingController.create);

// Endpoint: GET /api/admin/race-meetings
adminRaceMeetingRouter.get('/',adminRaceMeetingController.list);