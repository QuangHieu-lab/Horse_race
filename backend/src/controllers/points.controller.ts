import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getOrCreateProfile } from '../services/spectator.service.js';
import { HttpError } from '../utils/http-error.js';

export class PointsController {
  getMine = asyncHandler(async (req: Request, res: Response) => {
    const walletRoles = new Set(['spectator', 'horse_owner', 'jockey']);
    if (!walletRoles.has(req.user!.role)) {
      throw new HttpError(403, 'Role này không sử dụng ví điểm');
    }
    const points = await getOrCreateProfile(req.user!.id);
    res.json({ points });
  });
}
