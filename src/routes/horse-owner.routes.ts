import { Router } from 'express';
import { HorseOwnerController } from '../controllers/horse-owner.controller.js';


export const horseOwnerRouter = Router();
const controller = new HorseOwnerController();

// --- API Quản lý Ngựa ---
horseOwnerRouter.post('/horses', controller.createHorse);
horseOwnerRouter.get('/horses', controller.listMyHorses);
horseOwnerRouter.patch('/horses/:id', controller.updateHorseInfo);

// --- API Đăng ký trận đua ---
horseOwnerRouter.post('/registrations', controller.registerForRace);
horseOwnerRouter.get('/registrations', controller.listMyRegistrations);
horseOwnerRouter.delete('/registrations/:id', controller.cancelRegistration);

// --- API Lời mời Nài ngựa ---
horseOwnerRouter.post('/invitations', controller.inviteJockey);

// --- API Tìm kiếm Jockey theo tên ---
horseOwnerRouter.get('/jockeys/search', controller.searchJockeys);

// --- API Danh sách Giải đấu & Trận đua (để chọn khi đăng ký) ---
horseOwnerRouter.get('/tournaments', controller.listTournaments);
horseOwnerRouter.get('/tournaments/:tournamentId/races', controller.listRacesForTournament);
