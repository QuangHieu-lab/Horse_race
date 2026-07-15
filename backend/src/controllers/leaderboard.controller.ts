import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getRaceLeaderboard } from '../services/leaderboard.service.js';
import { listHorseLeaderboard } from '../services/spectator.service.js';
import { HttpError } from '../utils/http-error.js';

export class LeaderboardController {
  getByRace = asyncHandler(async (req: Request, res: Response) => {
    const leaderboard = await getRaceLeaderboard(String(req.params.raceId), req.user!.role);
    res.json({ leaderboard });
  });

  getHorses = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isFinite(limit) || limit < 1) {
      throw new HttpError(400, 'limit không hợp lệ');
    }
    const items = await listHorseLeaderboard(limit);
    res.json({ items });
  });
}
