import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Tournament, type ITournament } from '../models/Tournament.model.js';
import { HttpError } from '../utils/http-error.js';

export interface CreateTournamentInput {
  name: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  location: string;
  regulationsUrl?: string;
  prizePool?: number;
  predictionConfig?: ITournament['predictionConfig'];
}

export async function createTournament(
  creatorId: string,
  input: CreateTournamentInput,
): Promise<ITournament & { _id: mongoose.Types.ObjectId }> {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new HttpError(400, 'Ngày bắt đầu/kết thúc không hợp lệ');
  }
  if (endDate <= startDate) {
    throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu');
  }

  const tournament = await Tournament.create({
    ...input,
    startDate,
    endDate,
    createdBy: new mongoose.Types.ObjectId(creatorId),
  });

  return tournament.toObject();
}

export async function listTournaments(page = 1, limit = 10) {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(50, Math.max(1, limit));
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [items, total] = await Promise.all([
    Tournament.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .populate('createdBy', 'fullName email')
      .lean(),
    Tournament.countDocuments(),
  ]);

  return {
    items,
    total,
    page: normalizedPage,
    pages: Math.ceil(total / normalizedLimit) || 1,
  };
}

export async function getTournamentById(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'ID giải đấu không hợp lệ');
  }

  const tournament = await Tournament.findById(id)
    .populate('createdBy', 'fullName email')
    .lean();

  if (!tournament) {
    throw new HttpError(404, 'Không tìm thấy giải đấu');
  }

  const raceCount = await Race.countDocuments({ tournamentId: tournament._id });
  return { ...tournament, raceCount };
}

export async function updateTournamentStatus(id: string, status: ITournament['status']) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'ID giải đấu không hợp lệ');
  }

  const tournament = await Tournament.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  )
    .populate('createdBy', 'fullName email')
    .lean();

  if (!tournament) {
    throw new HttpError(404, 'Không tìm thấy giải đấu để cập nhật');
  }

  return tournament;
  
}
export async function deleteTournament(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'ID giải đấu không hợp lệ');
  }

  const tournament = await Tournament.findById(id);
  if (!tournament) {
    throw new HttpError(404, 'Không tìm thấy giải đấu để xóa');
  }

  if (tournament.status !== 'draft' && tournament.status !== 'published') {
    throw new HttpError(
      400, 
      `Không thể xóa giải đấu đang ở trạng thái "${tournament.status}".`
    );
  }

  // 💡 LỚP BẢO VỆ MỚI: Kiểm tra xem có trận đua nào đang gắn với giải đấu này không
  const existingRacesCount = await Race.countDocuments({ tournamentId: id });
  
  if (existingRacesCount > 0) {
    throw new HttpError(
      409, // 409 Conflict là mã HTTP chuẩn cho các lỗi dính líu đến dữ liệu quan hệ
      `Không thể xóa! Giải đấu này đang có ${existingRacesCount} trận đua bên trong. Vui lòng xóa tất cả các trận đua trực thuộc trước khi xóa giải đấu.`
    );
  }

  await Tournament.findByIdAndDelete(id);
  return true;
}
