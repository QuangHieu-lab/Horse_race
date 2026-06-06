import type { Request, Response } from 'express';
import { adminTrackService } from '../services/admin-track.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { HttpError } from '../utils/http-error.js';

export class AdminTrackController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const { name, location, countryCode, surfaceDefault, isActive } = req.body;

    // Validate các trường thông tin tối thiểu phải có
    if (!name || !location || !countryCode) {
      throw new HttpError(400, 'Vui lòng cung cấp đầy đủ thông tin bắt buộc: name, location và countryCode.');
    }

    const track = await adminTrackService.createTrack({
      name,
      location,
      countryCode,
      surfaceDefault: surfaceDefault || 'turf', // Mặc định là mặt cỏ nếu không truyền
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Đã tạo Trường đua mới thành công',
      data: track
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    // Hỗ trợ lọc qua query (VD: /api/admin/tracks?isActive=true)
    const filters: any = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }

    const tracks = await adminTrackService.listTracks(filters);

    res.status(200).json({
      success: true,
      data: tracks
    });
  });
}

export const adminTrackController = new AdminTrackController();