import type { Request, Response } from 'express';
import { RaceService } from '../services/race.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { HttpError } from '../utils/http-error.js';
const raceService = new RaceService();

export class RaceController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const newRace = await raceService.createRace(req.body);
    
    res.status(201).json({ 
      success: true, 
      message: 'Tạo trận đua thành công!',
      data: newRace 
    });
  });

  getByTournament = asyncHandler(async (req: Request, res: Response) => {
    const { tournamentId } = req.params;

    if (!tournamentId || Array.isArray(tournamentId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid tournament ID',
      });
      return;
    }

    const races = await raceService.getRacesByTournament(tournamentId);
    
    res.status(200).json({ success: true, data: races });
  });
getById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    
    if (!id || Array.isArray(id)) {
      throw new HttpError(400, 'ID Trận đua không hợp lệ');
    }

    const race = await raceService.getRaceById(id);
    
    if (!race) {
      throw new HttpError(404, 'Không tìm thấy trận đua!');
    }

    res.status(200).json({ success: true, data: race });
  });

  addParticipant = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    
    if (!id || Array.isArray(id)) {
      throw new HttpError(400, 'ID Trận đua không hợp lệ');
    }

    const updatedRace = await raceService.addParticipantToRace(id, req.body);
    
    if (!updatedRace) {
      throw new HttpError(404, 'Không tìm thấy trận đua!');
    }

    res.status(200).json({ 
      success: true, 
      message: 'Thêm thí sinh thành công!', 
      data: updatedRace 
    });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const { status } = req.body;
    
    if (!id || Array.isArray(id)) {
      throw new HttpError(400, 'ID Trận đua không hợp lệ');
    }

    const updatedRace = await raceService.updateRaceStatus(id, status);
    
    if (!updatedRace) {
      throw new HttpError(404, 'Không tìm thấy trận đua!');
    }

    res.status(200).json({ 
      success: true, 
      message: 'Cập nhật trạng thái trận đua thành công!', 
      data: updatedRace 
    });
  });
}