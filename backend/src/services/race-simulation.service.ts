import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result, type IRanking } from '../models/Result.model.js';
import { HttpError } from '../utils/http-error.js';
import { activeParticipants } from '../utils/race-participants.js';

export interface RaceSimHorse {
  horseId: string;
  horseName: string;
  jockeyId: string;
  jockeyName: string;
  ownerId: string;
  laneNumber: number;
  clothNumber: number;
  rank: number;
  finishTime: number; // giây
  prize: number;
}

export interface RaceSimTimeline {
  raceId: string;
  name: string;
  distance: number;
  laps: number;
  trackCondition: string;
  durationMs: number; // thời lượng phát lại gợi ý cho FE
  horses: RaceSimHorse[];
}

const RACING_PRIZE_BY_RANK: Record<number, number> = { 1: 500, 2: 300, 3: 200 };

/**
 * Admin "Start race": mô phỏng kết quả tức thì rồi tự xác nhận + công bố
 * (kéo theo chấm điểm dự đoán + settle bounty pool qua hook của Result).
 * Trả về timeline để FE phát lại animation — thứ hạng cuối luôn khớp finishTime đã lưu.
 */
export async function simulateAndPublishRace(
  raceId: string,
  adminId: string,
): Promise<RaceSimTimeline> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId)
    .populate('participants.horseId', 'name')
    .populate('participants.jockeyId', 'fullName');
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.status === 'completed') throw new HttpError(409, 'Cuộc đua đã kết thúc');
  if (race.status === 'cancelled') throw new HttpError(409, 'Cuộc đua đã bị hủy');

  const active = activeParticipants(race.participants);
  if (active.length < 2) {
    throw new HttpError(409, 'Cần ít nhất 2 ngựa để bắt đầu đua');
  }

  // Không cho mô phỏng lại nếu kết quả đã công bố trước đó
  const existing = await Result.findOne({ raceId: race._id });
  if (existing?.publishedAt) {
    throw new HttpError(409, 'Kết quả cuộc đua này đã được công bố');
  }

  // scheduled -> ongoing -> completed (Race model bắt buộc ongoing trước completed)
  if (race.status === 'scheduled') {
    race.status = 'ongoing';
    await race.save();
  }

  // Mô phỏng ngẫu nhiên đơn giản: finishTime 90–120s, ai nhỏ hơn về trước
  const sims = active
    .map((p) => ({ p, finishTime: Math.round((90 + Math.random() * 30) * 1000) / 1000 }))
    .sort((a, b) => a.finishTime - b.finishTime);

  const rankings: IRanking[] = sims.map((s, i) => {
    const horse = s.p.horseId as unknown as { _id: mongoose.Types.ObjectId };
    const jockey = s.p.jockeyId as unknown as { _id: mongoose.Types.ObjectId };
    return {
      rank: i + 1,
      horseId: horse._id,
      jockeyId: jockey._id,
      ownerId: s.p.ownerId,
      finishTime: s.finishTime,
      prize: RACING_PRIZE_BY_RANK[i + 1] ?? 0,
    };
  });

  race.status = 'completed';
  await race.save();

  // Ghi kết quả + tự xác nhận + công bố (hook publishedAt sẽ settle dự đoán)
  let result = existing ?? new Result({
    raceId: race._id,
    tournamentId: race.tournamentId,
    rankings: [],
    violations: [],
    protests: [],
    isPhotoFinish: false,
  });
  result.rankings = rankings;
  const now = new Date();
  const adminObjectId = new mongoose.Types.ObjectId(adminId);
  result.confirmedBy = adminObjectId;
  result.confirmedAt = now;
  result.publishedBy = adminObjectId;
  result.publishedAt = now;
  await result.save();

  const horses: RaceSimHorse[] = sims.map((s, i) => {
    const horse = s.p.horseId as unknown as { _id: mongoose.Types.ObjectId; name: string };
    const jockey = s.p.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    return {
      horseId: horse._id.toString(),
      horseName: horse.name,
      jockeyId: jockey._id.toString(),
      jockeyName: jockey.fullName,
      ownerId: s.p.ownerId.toString(),
      laneNumber: s.p.laneNumber,
      clothNumber: s.p.clothNumber ?? s.p.laneNumber,
      rank: i + 1,
      finishTime: s.finishTime,
      prize: RACING_PRIZE_BY_RANK[i + 1] ?? 0,
    };
  });

  return {
    raceId: race._id.toString(),
    name: race.name,
    distance: race.distance ?? 1200,
    laps: 1,
    trackCondition: race.going && race.going !== 'unknown' ? race.going : 'good',
    durationMs: 18000,
    horses,
  };
}
