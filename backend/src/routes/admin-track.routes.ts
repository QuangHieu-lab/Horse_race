import { Router } from 'express';
import { adminTrackController } from '../controllers/admin-track.controller.js';
// import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export const adminTrackRouter = Router();

// Endpoint: POST /api/admin/tracks
adminTrackRouter.post('/', adminTrackController.create);

// Endpoint: GET /api/admin/tracks
adminTrackRouter.get('/',adminTrackController.list);