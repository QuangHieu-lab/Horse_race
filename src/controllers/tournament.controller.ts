import type { Request, Response } from 'express';
import { TournamentService } from '../services/tournament.service.js';
import { asyncHandler } from '..//middleware/error.middleware.js'; // Nhớ trỏ đúng file middleware của bạn
import { HttpError } from '../utils/http-error.js'; //
const tournamentService = new TournamentService();

export class TournamentController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    // Tạm thời hardcode ID Admin (Sau này sẽ lấy từ Token: req.user._id)
    const adminId = '665000000000000000000001'; 
    
    const tournament = await tournamentService.createTournament(req.body, adminId);
    
    res.status(201).json({
      success: true,
      message: 'Tạo giải đấu thành công!',
      data: tournament
    });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await tournamentService.getAllTournaments(page, limit);
    res.status(200).json({ success: true, ...result });
  });
getById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id || Array.isArray(id)) {
      throw new HttpError(400, 'ID giải đấu không hợp lệ');
    }

    const tournament = await tournamentService.getTournamentById(id);

    if (!tournament) {
      throw new HttpError(404, 'Không tìm thấy giải đấu!');
    }

    res.status(200).json({ success: true, data: tournament });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body; 
    // Validate id
    const id = req.params.id;
    if (!id || Array.isArray(id)) {
      throw new HttpError(400, 'ID giải đấu không hợp lệ');
    }

    // Gọi Service thay vì thao tác trực tiếp với Database
    const tournament = await tournamentService.updateTournamentStatus(id, status);

    if (!tournament) {
      throw new HttpError(404, 'Không tìm thấy giải đấu để cập nhật!');
    }

    res.status(200).json({ 
      success: true, 
      message: 'Cập nhật trạng thái thành công', 
      data: tournament 
    });
  });
}