import type { Request, Response } from 'express';
import { adminRaceMeetingService } from '../services/admin-racemeeting.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { HttpError } from '../utils/http-error.js';

export class AdminRaceMeetingController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const { tournamentId, trackId, meetingDate, name, status } = req.body;

    // Validation cơ bản (Fail-fast)
    if (!tournamentId || !trackId || !meetingDate || !name) {
      throw new HttpError(400, 'Vui lòng cung cấp đầy đủ: tournamentId, trackId, meetingDate và name');
    }

    const meeting = await adminRaceMeetingService.createRaceMeeting({
      tournamentId,
      trackId,
      meetingDate,
      name,
      status: status || 'scheduled' // Mặc định là scheduled nếu không truyền
    });

    res.status(201).json({
      success: true,
      message: 'Tạo buổi đua thành công',
      data: meeting
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    // Bắt query params trên URL để hỗ trợ lọc (ví dụ: ?status=scheduled)
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.tournamentId) filters.tournamentId = req.query.tournamentId;

    const meetings = await adminRaceMeetingService.listRaceMeetings(filters);

    res.status(200).json({
      success: true,
      data: meetings
    });
  });
}

export const adminRaceMeetingController = new AdminRaceMeetingController();