import { Track } from '../models/Track.model.js'; // Đảm bảo import đúng đường dẫn model của bạn
import { HttpError } from '../utils/http-error.js';

export class AdminTrackService {
  /**
   * Tạo một Trường đua (Track / Venue) mới
   */
  async createTrack(data: {
    name: string;
    location: string;
    countryCode: string;
    surfaceDefault?: string;
    isActive?: boolean;
  }) {
    // Kiểm tra xem tên trường đua đã tồn tại chưa để tránh trùng lặp
    const existingTrack = await Track.findOne({ name: data.name });
    if (existingTrack) {
      throw new HttpError(400, `Trường đua mang tên "${data.name}" đã tồn tại trong hệ thống.`);
    }

    const newTrack = await Track.create(data);
    return newTrack;
  }

  /**
   * Lấy danh sách toàn bộ Trường đua
   */
  async listTracks(filters: any = {}) {
    // Lọc các trường đua đang hoạt động (isActive: true) nếu cần
    return await Track.find(filters)
      .sort({ createdAt: -1 }) // Sắp xếp mới nhất lên đầu
      .lean();
  }
}

export const adminTrackService = new AdminTrackService();