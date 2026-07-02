import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Race } from '../models/Race.model.js';
import { Result, type IRanking } from '../models/Result.model.js';
import { HttpError } from '../utils/http-error.js';
import type { RaceResultDto } from '../types/api.types.js';

export interface UpsertResultInput {
  rankings: Array<{
    rank: number;
    horseId: string;
    jockeyId: string;
    ownerId: string;
    finishTime?: number;
    prize?: number;
  }>;
}

function toResultDto(result: {
  _id: mongoose.Types.ObjectId;
  publishedAt?: Date | null;
  rankings: Array<{
    rank: number;
    horseId: mongoose.Types.ObjectId;
    jockeyId: mongoose.Types.ObjectId;
    finishTime?: number;
    prize: number;
  }>;
}): RaceResultDto {
  return {
    id: result._id.toString(),
    publishedAt: result.publishedAt?.toISOString() ?? null,
    rankings: result.rankings.map((r) => ({
      rank: r.rank,
      horse: { id: r.horseId.toString(), name: 'Horse' },
      jockey: { id: r.jockeyId.toString(), fullName: 'Jockey' },
      finishTime: r.finishTime,
      prize: r.prize,
    })),
  };
}

export async function upsertRaceResult(
  raceId: string,
  input: UpsertResultInput,
): Promise<{ id: string }> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (!['ongoing', 'completed'].includes(race.status)) {
    throw new HttpError(409, 'Chỉ ghi kết quả khi cuộc đua đang diễn ra hoặc đã kết thúc');
  }

  const rankings: IRanking[] = input.rankings.map((r) => ({
    rank: r.rank,
    horseId: new mongoose.Types.ObjectId(r.horseId),
    jockeyId: new mongoose.Types.ObjectId(r.jockeyId),
    ownerId: new mongoose.Types.ObjectId(r.ownerId),
    finishTime: r.finishTime,
    prize: r.prize ?? 0,
  }));

  let result = await Result.findOne({ raceId: race._id });
  if (result) {
    if (result.publishedAt) throw new HttpError(409, 'Kết quả đã công bố, không thể sửa');
    result.rankings = rankings;
    // 🚀 Nếu có cập nhật lại bản nháp thì trạng thái confirm phải trả về false
    (result as any).isConfirmed = false;
    await result.save();
  } else {
    result = await Result.create({
      raceId: race._id,
      tournamentId: race.tournamentId,
      rankings,
      violations: [],
      protests: [],
      isPhotoFinish: false,
      isConfirmed: false,
    });
  }

  return { id: result._id.toString() };
}

export async function confirmRaceResult(
  raceId: string,
  refereeId: string,
): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }
  if (race.status !== 'completed') {
    throw new HttpError(409, 'Cuộc đua chưa kết thúc');
  }

  const result = await Result.findOne({ raceId: race._id });
  if (!result || result.rankings.length === 0) {
    throw new HttpError(409, 'Chưa có kết quả để xác nhận');
  }
  if (result.publishedAt) throw new HttpError(409, 'Kết quả đã công bố');

  result.confirmedBy = new mongoose.Types.ObjectId(refereeId);
  result.confirmedAt = new Date();
  // 🚀 Đồng bộ cờ isConfirmed với hàm simulateRace
  (result as any).isConfirmed = true; 
  await result.save();

  await Notification.create({
    userId: new mongoose.Types.ObjectId(refereeId),
    type: 'result_confirmed',
    title: 'Kết quả đã xác nhận',
    message: `Kết quả ${race.name} đã xác nhận, chờ admin công bố.`,
    refModel: 'Result',
    refId: result._id,
  });
}

export async function publishRaceResult(raceId: string, adminId: string): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const result = await Result.findOne({ raceId: race._id });
  if (!result) throw new HttpError(404, 'Không tìm thấy kết quả');
  if (!result.confirmedAt) {
    throw new HttpError(409, 'Kết quả chưa được trọng tài xác nhận');
  }
  if (result.publishedAt) throw new HttpError(409, 'Kết quả đã công bố');

  result.publishedBy = new mongoose.Types.ObjectId(adminId);
  result.publishedAt = new Date();
  await result.save();
}

export async function listPublishQueue(): Promise<
  Array<{ raceId: string; raceName: string; confirmedAt: string | null; publishedAt: string | null }>
> {
  const results = await Result.find({ confirmedAt: { $ne: null } })
    .populate('raceId', 'name')
    .sort({ confirmedAt: -1 })
    .lean();

  return results.map((r) => {
    const race = r.raceId as unknown as { _id: mongoose.Types.ObjectId; name: string };
    return {
      raceId: race._id.toString(),
      raceName: race.name,
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    };
  });
}

export async function getResultByRaceId(raceId: string) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }
  const result = await Result.findOne({ raceId }).lean();
  if (!result) return null;
  return {
    id: result._id.toString(),
    confirmedAt: result.confirmedAt?.toISOString() ?? null,
    publishedAt: result.publishedAt?.toISOString() ?? null,
    rankingsCount: result.rankings.length,
  };
}