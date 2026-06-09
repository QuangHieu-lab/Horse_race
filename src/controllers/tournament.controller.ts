import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createTournament,
  deleteTournament,
  getTournamentById,
  listTournaments,
  updateTournamentStatus,
} from '../services/tournament.service.js';

export class TournamentController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await createTournament(req.user!.id, req.body);
    res.status(201).json({ tournament });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const result = await listTournaments(page, limit);
    res.json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await getTournamentById(String(req.params.id));
    res.json({ tournament });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const tournament = await updateTournamentStatus(
      String(req.params.id),
      req.body.status,
    );
    res.json({ tournament });
  });
  delete = asyncHandler(async (req: Request, res: Response) => {
    await deleteTournament(String(req.params.id));
    // Giữ format trả về ngắn gọn giống các hàm trên
    res.json({ success: true, message: 'Đã xóa giải đấu thành công' }); 
  });
}
