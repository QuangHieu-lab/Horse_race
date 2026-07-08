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

function validatePredictionConfigRates(config: ITournament['predictionConfig']): void {
  const poolRateTotal =
    (config.organizerFeeRate ?? 10) +
    (config.racingRewardRate ?? 15) +
    (config.spectatorRewardRate ?? 75);
  if (poolRateTotal !== 100) {
    throw new HttpError(400, 'Tổng tỷ lệ organizer/racing/spectator phải bằng 100');
  }
  if ((config.ownerShareRate ?? 80) + (config.jockeyShareRate ?? 20) !== 100) {
    throw new HttpError(400, 'Tổng tỷ lệ owner/jockey phải bằng 100');
  }
  const rankTotal = (config.rankRewardRates ?? [50, 25, 15, 7, 3]).reduce(
    (sum, rate) => sum + rate,
    0,
  );
  if (rankTotal !== 100) {
    throw new HttpError(400, 'Tổng tỷ lệ chia theo thứ hạng phải bằng 100');
  }
  const quickRiskMultipliers = config.quickRiskMultipliers ?? [1];
  if (
    quickRiskMultipliers.length > 0 &&
    quickRiskMultipliers.some((multiplier) => !Number.isInteger(multiplier) || multiplier < 1)
  ) {
    throw new HttpError(400, 'Allowed risk multipliers must contain positive integers');
  }
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

  // Đếm số trận đua của từng giải trong danh sách (1 truy vấn gộp)
  const ids = items.map((t) => t._id);
  const counts = await Race.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { tournamentId: { $in: ids } } },
    { $group: { _id: '$tournamentId', count: { $sum: 1 } } },
  ]);
  const countByTournament = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return {
    items: items.map((t) => ({ ...t, raceCount: countByTournament.get(t._id.toString()) ?? 0 })),
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

  if (['published', 'ongoing'].includes(status)) {
    const raceCount = await Race.countDocuments({ tournamentId: id });
    if (raceCount === 0) {
      throw new HttpError(409, 'Cần tạo ít nhất một cuộc đua trước khi công bố giải đấu');
    }
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

export async function updatePredictionConfig(
  id: string,
  predictionConfig: Partial<ITournament['predictionConfig']>,
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'ID giải đấu không hợp lệ');
  }

  const tournament = await Tournament.findById(id);
  if (!tournament) {
    throw new HttpError(404, 'Không tìm thấy giải đấu để cập nhật');
  }
  if (!['draft', 'published'].includes(tournament.status)) {
    throw new HttpError(409, 'Chỉ chỉnh cấu hình dự đoán khi giải đấu chưa bắt đầu');
  }

  tournament.predictionConfig = {
    ...tournament.predictionConfig,
    ...predictionConfig,
  };
  validatePredictionConfigRates(tournament.predictionConfig);
  await tournament.save();

  return tournament.toObject();
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
