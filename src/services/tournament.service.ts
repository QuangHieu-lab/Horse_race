import {Tournament} from '../models/Tournament.model.js';
import type {  ITournament } from '../models/Tournament.model.js';

import { HttpError } from '../utils/http-error.js';
import mongoose from 'mongoose';

export class TournamentService {
  async createTournament(data: Partial<ITournament>, creatorId: string) {
    // Ràng buộc logic: Ngày kết thúc phải sau ngày bắt đầu
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) <= new Date(data.startDate)) {
        throw new HttpError(400, 'Ngày kết thúc giải đấu phải sau ngày bắt đầu.');
      }
    }

    const tournament = new Tournament({
      ...data,
      createdBy: new mongoose.Types.ObjectId(creatorId),
    });

    return await tournament.save();
  }

  async getAllTournaments(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const items = await Tournament.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'fullName email'); // Lấy thêm thông tin người tạo
    
    const total = await Tournament.countDocuments();
    return { items, total, page, pages: Math.ceil(total / limit) };
  } 
// Lấy chi tiết giải đấu
  async getTournamentById(id: string) {
    return await Tournament.findById(id).populate('createdBy', 'fullName email');
  }

  // Cập nhật trạng thái giải đấu
  async updateTournamentStatus(id: string, status: string) {
    return await Tournament.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );
  }
}