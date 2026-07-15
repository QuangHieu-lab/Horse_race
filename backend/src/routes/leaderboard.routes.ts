import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller.js';

export const leaderboardRouter = Router();
const leaderboardController = new LeaderboardController();

// Bảng xếp hạng thành tích ngựa toàn hệ thống — dùng chung cho mọi role đã đăng nhập.
// Phải đăng ký trước '/:raceId' để không bị route đó nuốt mất ('/horses' khớp :raceId="horses").
leaderboardRouter.get('/horses', leaderboardController.getHorses);

// Bảng xếp hạng dùng chung cho mọi role đã đăng nhập (cổng hiển thị xử lý trong service).
leaderboardRouter.get('/:raceId', leaderboardController.getByRace);
