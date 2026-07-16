import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getOrCreateProfile } from '../services/spectator.service.js';
import { HttpError } from '../utils/http-error.js';

export class PointsController {
  getMine = asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role === 'admin') {
      throw new HttpError(403, 'Admin uses OrganizerLedger and does not have a point wallet');
    }
    const points = await getOrCreateProfile(req.user!.id);
    res.json({ points });
  });
}
