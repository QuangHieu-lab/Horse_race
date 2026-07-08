import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { HttpError } from '../utils/http-error.js';
import {
  createRace,
  getRaceById,
  getRacesByTournament,
  updateRaceStatus,
  deleteRace,
  addParticipantToRace,
  assignRaceReferee,
} from '../services/race.service.js';
import { listEligibleEntries } from '../services/race-participant.service.js';

export class RaceController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const race = await createRace(req.body);
    res.status(201).json({ race });
  });

  getByTournament = asyncHandler(async (req: Request, res: Response) => {
    const races = await getRacesByTournament(String(req.params.tournamentId));
    res.json({ races });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const race = await getRaceById(String(req.params.id));
    res.json({ race });
  });

  addParticipant = asyncHandler(async (req: Request, res: Response) => {
    // Ép kiểu bằng any để lấy body nhanh gọn
    const input = req.body as any;

    // 1. Chỉ bắt buộc 3 thông tin định danh
    if (!input.horseId || !input.jockeyId || !input.ownerId) {
      throw new HttpError(400, 'Thiếu thông tin bắt buộc (horseId, jockeyId, ownerId)');
    }

    // 2. Làn chạy và áo số là optional, nhưng nếu có truyền thì phải > 0
    if (input.laneNumber !== undefined && input.laneNumber <= 0) {
      throw new HttpError(400, 'Làn chạy phải lớn hơn 0');
    }
    if (input.clothNumber !== undefined && input.clothNumber <= 0) {
      throw new HttpError(400, 'Số áo phải lớn hơn 0');
    }

    // 3. Gọi Service
    const race = await addParticipantToRace(String(req.params.id), {
      horseId: input.horseId,
      jockeyId: input.jockeyId,
      ownerId: input.ownerId,
    });

    res.json({ race });
  });

  eligibleEntries = asyncHandler(async (req: Request, res: Response) => {
    const entries = await listEligibleEntries(String(req.params.id));
    res.json({ entries });
  });

  simulate = asyncHandler(async (req: Request, res: Response) => {
    throw new HttpError(403, 'Chi trong tai phu trach moi duoc boc tham lan va bat dau cuoc dua');
  });

  finishRace = asyncHandler(async (req: Request, res: Response) => {
    throw new HttpError(403, 'Chi trong tai phu trach moi duoc hoan tat luong chay dua');
  });

  assignReferee = asyncHandler(async (req: Request, res: Response) => {
    const { refereeId } = req.body as { refereeId?: string | null };
    const race = await assignRaceReferee(String(req.params.id), refereeId ?? null);
    res.json({ race });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const race = await updateRaceStatus(String(req.params.id), req.body.status);
    res.json({ race });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await deleteRace(String(req.params.id));
    res.json({ success: true, message: 'Đã xóa trận đua thành công' });
  });
}
