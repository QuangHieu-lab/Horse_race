import mongoose from 'mongoose';
// Import model của bạn (Đảm bảo đường dẫn đúng với dự án)
import { RaceMeeting } from '../models/RaceMeeting.model.js'; 
import { HttpError } from '../utils/http-error.js';

export class AdminRaceMeetingService {
  /**
   * Admin tạo một Buổi đua (Race Meeting) mới
   */
  async createRaceMeeting(data: {
    tournamentId: string;
    trackId: string;
    meetingDate: Date;
    name: string;
    status?: string;
  }) {
    // Kiểm tra định dạng ID của MongoDB để tránh lỗi vặt
    if (!mongoose.isValidObjectId(data.tournamentId) || !mongoose.isValidObjectId(data.trackId)) {
      throw new HttpError(400, 'ID của Giải đấu (tournamentId) hoặc Trường đua (trackId) không hợp lệ');
    }

    const newMeeting = await RaceMeeting.create(data);
    return newMeeting;
  }

  /**
   * Admin lấy danh sách các Buổi đua
   */
  async listRaceMeetings(filters: any = {}) {
    // Dùng populate để lấy luôn tên Giải đấu và tên Trường đua trả về cho FE/Mobile
    return await RaceMeeting.find(filters)
      .populate('tournamentId', 'name') // Lấy tên Giải đấu
      .populate('trackId', 'name location') // Lấy tên và địa điểm Trường đua
      .sort({ meetingDate: 1 }) // Sắp xếp theo ngày diễn ra (từ sớm đến muộn)
      .lean();
  }
}

export const adminRaceMeetingService = new AdminRaceMeetingService();