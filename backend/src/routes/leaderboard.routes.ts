import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller.js';

export const leaderboardRouter = Router();
const leaderboardController = new LeaderboardController();

// Bảng xếp hạng dùng chung cho mọi role đã đăng nhập (cổng hiển thị xử lý trong service).
leaderboardRouter.get('/:raceId', leaderboardController.getByRace);
