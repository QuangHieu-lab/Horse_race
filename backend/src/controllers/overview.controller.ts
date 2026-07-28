import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  listHorseLeaderboard,
  listJockeyLeaderboard,
  listTournaments,
} from '../services/spectator.service.js';
import { HttpError } from '../utils/http-error.js';

export class OverviewController {
  getSidebar = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit === undefined ? 3 : Number(req.query.limit);
    if (!Number.isFinite(limit) || limit < 1) {
      throw new HttpError(400, 'limit không hợp lệ');
    }

    const normalizedLimit = Math.min(5, Math.max(1, Math.floor(limit)));
    const [tournaments, horses, jockeys] = await Promise.all([
      listTournaments(),
      listHorseLeaderboard(normalizedLimit),
      listJockeyLeaderboard(normalizedLimit),
    ]);

    const featuredTournaments = tournaments
      .slice()
      .sort((a, b) => {
        if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
        if (a.status !== 'ongoing' && b.status === 'ongoing') return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      })
      .slice(0, normalizedLimit);

    res.json({
      tournaments: featuredTournaments,
      leaderboard: { horses, jockeys },
      generatedAt: new Date().toISOString(),
    });
  });
}
