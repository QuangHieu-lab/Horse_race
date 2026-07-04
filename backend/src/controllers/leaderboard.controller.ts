import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getRaceLeaderboard } from '../services/leaderboard.service.js';

export class LeaderboardController {
  getByRace = asyncHandler(async (req: Request, res: Response) => {
    const leaderboard = await getRaceLeaderboard(String(req.params.raceId), req.user!.role);
    res.json({ leaderboard });
  });
}
