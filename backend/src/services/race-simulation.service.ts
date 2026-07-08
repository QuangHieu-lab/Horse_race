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
  trackName: string | null;
  trackLocation: string | null;
  surface: string; // turf | synthetic | dirt
  durationMs: number; // thời lượng phát lại gợi ý cho FE
  horses: RaceSimHorse[];
}

const RACING_PRIZE_BY_RANK: Record<number, number> = { 1: 500, 2: 300, 3: 200 };

/**
 * Admin "Start race": mô phỏng kết quả tức thì rồi tự xác nhận + công bố
 * (kéo theo chấm điểm dự đoán + settle bounty pool qua hook của Result).
 * Trả về timeline để FE phát lại animation — thứ hạng cuối luôn khớp finishTime đã lưu.
 */
/**
 * BƯỚC 1 — Admin bắt đầu đua: đưa race sang 'ongoing' (hook: giải đấu → Live),
 * mô phỏng kết quả và lưu BẢN NHÁP (chưa công bố). Trả timeline để phát animation.
 * Kết quả chỉ được công bố ở bước finish (khi animation kết thúc).
 */
export async function startRaceSimulation(raceId: string): Promise<RaceSimTimeline> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId)
    .populate('trackId', 'name location surfaceDefault')
    .populate('participants.horseId', 'name')
    .populate('participants.jockeyId', 'fullName');
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.status === 'completed') throw new HttpError(409, 'Cuộc đua đã kết thúc');
  if (race.status === 'cancelled') throw new HttpError(409, 'Cuộc đua đã bị hủy');

  if (race.status !== 'ready') {
    throw new HttpError(409, 'Trong tai phai boc tham lan va bat dau cuoc dua truoc khi chay mo phong');
  }
  race.status = 'ongoing';
  await race.save();

  const active = activeParticipants(race.participants);
  if (active.length < 2) {
    throw new HttpError(409, 'Cần ít nhất 2 ngựa để bắt đầu đua');
  }

  const existing = await Result.findOne({ raceId: race._id });
  if (existing?.publishedAt) {
    throw new HttpError(409, 'Kết quả cuộc đua này đã được công bố');
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

  // Lưu bản nháp (chưa confirm/publish) — công bố ở bước finish
  await Result.findOneAndUpdate(
    { raceId: race._id },
    { rankings, isPhotoFinish: false, $setOnInsert: { tournamentId: race.tournamentId } },
    { upsert: true, new: true },
  );

  const horses: RaceSimHorse[] = sims.map((s, i) => {
    const horse = s.p.horseId as unknown as { _id: mongoose.Types.ObjectId; name: string };
    const jockey = s.p.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    if (!s.p.laneNumber) {
      throw new HttpError(409, 'Cuoc dua chua duoc trong tai boc tham lan');
    }
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

  const track = race.trackId as unknown as
    | { name: string; location: string; surfaceDefault: string }
    | null;
  const surface = track?.surfaceDefault ?? race.surface ?? 'turf';

  return {
    raceId: race._id.toString(),
    name: race.name,
    distance: race.distance ?? 1200,
    laps: 1,
    trackCondition: race.going && race.going !== 'unknown' ? race.going : 'good',
    trackName: track?.name ?? null,
    trackLocation: track?.location ?? null,
    surface,
    durationMs: 18000,
    horses,
  };
}

/**
 * BƯỚC 2 — Kết thúc đua (khi animation xong): race -> 'completed'
 * (hook: giải đấu trở lại Registration), rồi tự xác nhận + công bố kết quả
 * (hook publishedAt settle dự đoán). Idempotent nếu đã công bố.
 */
export async function finishRaceSimulation(raceId: string, adminId: string): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const result = await Result.findOne({ raceId: race._id });
  if (!result || result.rankings.length === 0) {
    throw new HttpError(409, 'Chưa có kết quả — hãy bắt đầu đua trước.');
  }
  if (result.publishedAt) return; // đã công bố -> bỏ qua (idempotent)

  // ongoing -> completed (hook đồng bộ: giải đấu -> Registration)
  if (race.status === 'ongoing') {
    race.status = 'completed';
    await race.save();
  } else if (race.status !== 'completed') {
    throw new HttpError(409, 'Cuộc đua chưa bắt đầu');
  }

  const now = new Date();
  const adminObjectId = new mongoose.Types.ObjectId(adminId);
  result.confirmedBy = adminObjectId;
  result.confirmedAt = now;
  result.publishedBy = adminObjectId;
  result.publishedAt = now;
  await result.save();
}
