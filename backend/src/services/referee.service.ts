import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { Horse } from '../models/Horse.model.js';
import { User } from '../models/User.model.js';
import { Notification } from '../models/Notification.model.js';
import { HttpError } from '../utils/http-error.js';
import { ViolationRule } from '../models/ViolationRule.model.js';
import { activeParticipants, randomizeActiveParticipantLanes } from '../utils/race-participants.js';
import type { RaceSimTimeline } from './race-simulation.service.js';

export interface RefereeRaceDto {
  id: string;
  name: string;
  round: number;
  scheduledAt: string;
  status: string;
  participantCount: number;
  hasResult: boolean;
  confirmedAt: string | null;
  publishedAt: string | null;
}

export interface RefereeCheckDto {
  raceId: string;
  raceName: string;
  horseId: string;
  horseName: string;
  horseRegistrationId: string | null;
  horseBreed: string;
  horseSire: string | null;
  horseDam: string | null;
  horseTrainerName: string | null;
  horseAge: number;
  horseColor: string | null;
  horseWeight: number | null;
  horseHealthStatus: string;
  horseImageUrl: string | null;
  horseProfilePdfUrl: string | null;
  horseProfilePdfName: string | null;
  jockeyId: string;
  jockeyName: string;
  ownerId: string;
  ownerName: string;
  laneNumber: number | null;
  clothNumber: number | null;
  vetApproved: boolean;
  confirmed: boolean;
}

function refreshRankingOrder(result: { rankings: Array<{ rank: number; finishTime?: number; marginBehind?: number; isDeadHeat?: boolean }> }): void {
  result.rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
    if (index === 0) {
      ranking.marginBehind = 0;
      ranking.isDeadHeat = false;
      return;
    }

    const prevTime = result.rankings[index - 1]?.finishTime;
    const currentTime = ranking.finishTime;
    if (prevTime === undefined || currentTime === undefined) {
      ranking.marginBehind = undefined;
      ranking.isDeadHeat = false;
      return;
    }

    const timeGap = parseFloat((currentTime - prevTime).toFixed(3));
    ranking.marginBehind = Math.max(0, timeGap);
    ranking.isDeadHeat = timeGap === 0;
  });
}

function mapResultSaveError(err: unknown): HttpError {
  const message = err instanceof Error ? err.message : 'Không thể lưu biên bản kết quả';
  if (message.includes('marginBehind')) {
    return new HttpError(409, 'Không thể tính marginBehind hợp lệ sau khi áp dụng án phạt. Vui lòng kiểm tra lại bảng xếp hạng.');
  }
  if (message.includes('Rankings') || message.includes('rank') || message.includes('Violation')) {
    return new HttpError(409, message);
  }
  return new HttpError(500, message);
}

// Hạ bậc ngựa vi phạm xuống ngay sau "ngựa bị ảnh hưởng" (dùng cho penaltyApplied 'demote').
function applyRelegationToRankings(
  result: { rankings: Array<{ horseId: mongoose.Types.ObjectId; rank: number; finishTime?: number; marginBehind?: number; isDeadHeat?: boolean }> },
  penalizedHorseId: mongoose.Types.ObjectId,
  affectedHorseId: mongoose.Types.ObjectId,
): void {
  const penalizedIndex = result.rankings.findIndex((r) => r.horseId.toString() === penalizedHorseId.toString());
  const affectedIndex = result.rankings.findIndex((r) => r.horseId.toString() === affectedHorseId.toString());
  if (penalizedIndex === -1) throw new HttpError(400, 'Ngựa vi phạm chưa có trong bảng xếp hạng để hạ bậc');
  if (affectedIndex === -1) throw new HttpError(400, 'Ngựa bị ảnh hưởng chưa có trong bảng xếp hạng');
  if (penalizedIndex > affectedIndex) throw new HttpError(409, 'Ngựa vi phạm đã đứng sau ngựa bị ảnh hưởng, không cần hạ bậc');
  const [penalized] = result.rankings.splice(penalizedIndex, 1);
  if (!penalized) throw new HttpError(500, 'Không thể hạ bậc ngựa vi phạm');
  const nextAffectedIndex = result.rankings.findIndex((r) => r.horseId.toString() === affectedHorseId.toString());
  result.rankings.splice(nextAffectedIndex + 1, 0, penalized);
  refreshRankingOrder(result);
}

function applyDisqualificationToRankings(
  result: { rankings: Array<{ horseId: mongoose.Types.ObjectId; rank: number; finishTime?: number; marginBehind?: number; isDeadHeat?: boolean; prize?: number }> },
  disqualifiedHorseId: mongoose.Types.ObjectId,
): void {
  const index = result.rankings.findIndex((r) => r.horseId.toString() === disqualifiedHorseId.toString());
  if (index === -1) return;

  result.rankings.splice(index, 1);
  refreshRankingOrder(result);
}

function isDopingRule(rule: { code?: string; name?: string; description?: string; category?: string }): boolean {
  const haystack = `${rule.code ?? ''} ${rule.name ?? ''} ${rule.description ?? ''} ${rule.category ?? ''}`.toLowerCase();
  return haystack.includes('doping');
}

function resolvePenaltyBanUntil(rule: { banDurationDays: number; penaltyApplied: string }, forceBan: boolean): Date | null {
  if (rule.banDurationDays > 0) {
    const bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + rule.banDurationDays);
    return bannedUntil;
  }
  if (forceBan || rule.penaltyApplied === 'permanent_ban') {
    return null;
  }
  return null;
}

function raceDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function endOfRaceDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function describeBanDuration(
  rule: { banDurationDays: number },
  bannedUntil: Date | null,
  hasBan: boolean,
): string {
  if (!hasBan) {
    return 'Án tước quyền chỉ áp dụng cho kết quả cuộc đua này, không có số ngày cấm thi đấu bổ sung';
  }
  if (rule.banDurationDays > 0) {
    return `Án phạt ${rule.banDurationDays} ngày thi đấu thực tế${bannedUntil ? `, hiệu lực đến hết ${bannedUntil.toISOString()}` : ', chờ cập nhật thêm lịch đua để xác định ngày kết thúc'}`;
  }
  return 'Án phạt cấm thi đấu không có thời hạn kết thúc tự động';
}

async function resolveCompetitionDayBanUntil(
  banRaceDays: number,
  fromDate: Date,
): Promise<Date> {
  const races = await Race.find({
    scheduledAt: { $gt: fromDate },
    status: { $ne: 'cancelled' },
  })
    .select('scheduledAt')
    .sort({ scheduledAt: 1 })
    .lean();

  const raceDays: Date[] = [];
  const seen = new Set<string>();
  for (const race of races) {
    const key = raceDayKey(race.scheduledAt);
    if (seen.has(key)) continue;
    seen.add(key);
    raceDays.push(race.scheduledAt);
    if (raceDays.length >= banRaceDays) break;
  }

  const targetDay = raceDays[banRaceDays - 1];
  if (targetDay) return endOfRaceDay(targetDay);

  // Not enough scheduled race days yet to count out the full ban — fall back to a calendar-day estimate
  const fallback = new Date(fromDate);
  fallback.setDate(fallback.getDate() + banRaceDays);
  return endOfRaceDay(fallback);
}

export async function getRefereeDashboard(refereeId: string) {
  const objectId = new mongoose.Types.ObjectId(refereeId);
  const [upcoming, completed, pendingConfirm] = await Promise.all([
    Race.countDocuments({ refereeId: objectId, status: { $in: ['scheduled', 'ready', 'ongoing'] } }),
    Race.countDocuments({ refereeId: objectId, status: 'completed' }),
    Result.countDocuments({
      confirmedAt: null,
      publishedAt: null,
    }),
  ]);

  return { upcomingRaces: upcoming, completedRaces: completed, pendingConfirmations: pendingConfirm };
}

export async function listRefereeRaces(refereeId: string): Promise<RefereeRaceDto[]> {
  const races = await Race.find({ refereeId: new mongoose.Types.ObjectId(refereeId) })
    .sort({ scheduledAt: -1 })
    .lean();

  const raceIds = races.map((r) => r._id);
  const results = await Result.find({ raceId: { $in: raceIds } }).lean();
  const resultMap = new Map(results.map((r) => [r.raceId.toString(), r]));

  return races.map((race) => {
    const result = resultMap.get(race._id.toString());
    return {
      id: race._id.toString(),
      name: race.name,
      round: race.round,
      scheduledAt: race.scheduledAt.toISOString(),
      status: race.status,
      participantCount: activeParticipants(race.participants).length,
      hasResult: !!result && result.rankings.length > 0,
      confirmedAt: result?.confirmedAt?.toISOString() ?? null,
      publishedAt: result?.publishedAt?.toISOString() ?? null,
    };
  });
}

export async function listRefereeChecks(refereeId: string, raceId: string): Promise<RefereeCheckDto[]> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId)
    .populate(
      'participants.horseId',
      'name registrationId breed sire dam trainerName age color weight healthStatus imageUrl profilePdfUrl profilePdfName',
    )
    .populate('participants.jockeyId', 'fullName')
    .populate('participants.ownerId', 'fullName')
    .lean();

  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }

  return race.participants.map((p) => {
    const horse = p.horseId as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      registrationId?: string;
      breed: string;
      sire?: string;
      dam?: string;
      trainerName?: string;
      age: number;
      color?: string;
      weight?: number;
      healthStatus: string;
      imageUrl?: string;
      profilePdfUrl?: string;
      profilePdfName?: string;
    };
    const jockey = p.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    const owner = p.ownerId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    return {
      raceId: race._id.toString(),
      raceName: race.name,
      horseId: horse._id.toString(),
      horseName: horse.name,
      horseRegistrationId: horse.registrationId ?? null,
      horseBreed: horse.breed,
      horseSire: horse.sire ?? null,
      horseDam: horse.dam ?? null,
      horseTrainerName: horse.trainerName ?? null,
      horseAge: horse.age,
      horseColor: horse.color ?? null,
      horseWeight: horse.weight ?? null,
      horseHealthStatus: horse.healthStatus,
      horseImageUrl: horse.imageUrl ?? null,
      horseProfilePdfUrl: horse.profilePdfUrl ?? null,
      horseProfilePdfName: horse.profilePdfName ?? null,
      jockeyId: jockey._id.toString(),
      jockeyName: jockey.fullName,
      ownerId: owner._id.toString(),
      ownerName: owner.fullName,
      laneNumber: p.laneNumber ?? null,
      clothNumber: p.clothNumber ?? null,
      vetApproved: !!p.vetApprovedAt,
      confirmed: !!p.confirmedAt,
    };
  });
}

export async function toggleParticipantCheck(
  refereeId: string,
  raceId: string,
  horseId: string,
  field: 'vetApprovedAt' | 'confirmedAt',
): Promise<void> {
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }

  const participant = race.participants.find((p) => p.horseId.toString() === horseId);
  if (!participant) throw new HttpError(404, 'Không tìm thấy ngựa trong cuộc đua');

  if (field === 'vetApprovedAt') {
    participant.vetApprovedAt = participant.vetApprovedAt ? null : new Date();
  } else {
    participant.confirmedAt = participant.confirmedAt ? null : new Date();
  }

  await race.save();
}

// 🚀 Chuyển từ race.service sang
export async function simulateRace(raceId: string) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) {
    throw new HttpError(404, 'Không tìm thấy trận đua để giả lập');
  }

  if (race.status === 'completed' || race.status === 'cancelled') {
    throw new HttpError(409, 'Không thể giả lập trận đua đã kết thúc hoặc bị hủy');
  }

  if (race.status !== 'ready') {
    throw new HttpError(409, 'Can boc tham lan va bat dau cuoc dua truoc khi chay mo phong');
  }
  race.status = 'ongoing';
  await race.save();

  const activeList = activeParticipants(race.participants);
  if (activeList.length < 2) {
    throw new HttpError(409, 'Cần ít nhất 2 thí sinh đang hoạt động để chạy giả lập');
  }

  const simulatedData = activeList.map(participant => {
    const randomFinishTime = 90 + (Math.random() * 30);
    return {
      horseId: participant.horseId,
      jockeyId: participant.jockeyId,
      ownerId: participant.ownerId,
      finishTime: parseFloat(randomFinishTime.toFixed(3)),
    };
  });

  simulatedData.sort((a, b) => a.finishTime - b.finishTime);

  const rankings = simulatedData.map((data, index) => ({
    horseId: data.horseId,
    jockeyId: data.jockeyId,
    ownerId: data.ownerId,
    rank: index + 1,
    finishTime: data.finishTime,
    prize: 0,
  }));

  await Result.findOneAndUpdate(
    { raceId: new mongoose.Types.ObjectId(raceId) },
    {
      rankings,
      isPhotoFinish: false,
      // bảo đảm có tournamentId khi tạo mới (tránh lỗi validate ở các lần save sau)
      $setOnInsert: { tournamentId: race.tournamentId },
    },
    { upsert: true, new: true },
  );

  // Giữ race ở 'ongoing' (Live) trong suốt lúc ngựa chạy & trọng tài xem trực tiếp.
  // Chỉ chuyển 'completed' khi trọng tài xem xong (gọi finishRefereeRace).

  // Dựng timeline phát lại (giống admin) để trọng tài xem đua trực tiếp
  const populated = await Race.findById(raceId)
    .populate('trackId', 'name location surfaceDefault')
    .populate('participants.horseId', 'name')
    .populate('participants.jockeyId', 'fullName')
    .lean();
  if (!populated) throw new HttpError(500, 'Lỗi khi dựng dữ liệu trận đua');

  const pByHorse = new Map<string, (typeof populated.participants)[number]>();
  for (const p of populated.participants) {
    const h = p.horseId as unknown as { _id: mongoose.Types.ObjectId } | null;
    if (h?._id) pByHorse.set(h._id.toString(), p);
  }

  const horses = rankings.map((r) => {
    const p = pByHorse.get(r.horseId.toString());
    const horse = p?.horseId as unknown as { _id: mongoose.Types.ObjectId; name: string };
    const jockey = p?.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    return {
      horseId: horse._id.toString(),
      horseName: horse.name,
      jockeyId: jockey._id.toString(),
      jockeyName: jockey.fullName,
      ownerId: r.ownerId.toString(),
      laneNumber: p?.laneNumber ?? r.rank,
      clothNumber: p?.clothNumber ?? p?.laneNumber ?? r.rank,
      rank: r.rank,
      finishTime: r.finishTime,
      prize: r.prize,
    };
  });

  const track = populated.trackId as unknown as
    | { name: string; location: string; surfaceDefault: string }
    | null;

  const timeline: RaceSimTimeline = {
    raceId,
    name: populated.name,
    distance: populated.distance ?? 1200,
    laps: 1,
    trackCondition: populated.going && populated.going !== 'unknown' ? populated.going : 'good',
    trackName: track?.name ?? null,
    trackLocation: track?.location ?? null,
    surface: track?.surfaceDefault ?? populated.surface ?? 'turf',
    durationMs: 18000,
    horses,
  };

  return timeline;
}

/**
 * Kết thúc cuộc đua: chuyển 'ongoing' → 'completed' khi trọng tài đã xem xong đua
 * và kết quả tạm thời đã hiển thị. Idempotent nếu đã completed.
 */
export async function finishRefereeRace(refereeId: string, raceId: string): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }
  if (race.status === 'completed') return; // đã kết thúc thì bỏ qua
  if (race.status !== 'ongoing') {
    throw new HttpError(409, 'Chỉ kết thúc được cuộc đua đang diễn ra (Live)');
  }
  race.status = 'completed';
  await race.save();
}

export async function buildResultFromRace(raceId: string, refereeId: string) {
  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }

  const existing = await Result.findOne({ raceId: race._id }).select('rankings publishedAt').lean();
  if (existing?.publishedAt) {
    throw new HttpError(409, 'Kết quả đã công bố, không thể sửa');
  }
  if (existing?.rankings?.length) {
    return existing.rankings.map((r) => ({
      rank: r.rank,
      horseId: r.horseId.toString(),
      jockeyId: r.jockeyId.toString(),
      ownerId: r.ownerId.toString(),
      finishTime: r.finishTime,
      prize: r.prize ?? 0,
    }));
  }

  const active = activeParticipants(race.participants);
  return active.map((p, idx) => ({
    rank: idx + 1,
    horseId: p.horseId.toString(),
    jockeyId: p.jockeyId.toString(),
    ownerId: p.ownerId.toString(),
    finishTime: 120 + idx * 2,
    prize: 1000 - idx * 100,
  }));
}

export async function applyRacePenalty(
  refereeId: string,
  raceId: string,
  payload: { ruleId: string; target: 'horse' | 'jockey'; horseId?: string; jockeyId?: string; affectedHorseId?: string; notes?: string; }
): Promise<void> {
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');
  if (race.refereeId?.toString() !== refereeId) throw new HttpError(403, 'Không có quyền truy cập');
  // Cho phép lập biên bản khi đang đua (ongoing) HOẶC sau khi chạy đua nhưng
  // kết quả nháp chưa được xác nhận/công bố (completed + draft).
  if (race.status === 'scheduled' || race.status === 'cancelled') {
    throw new HttpError(400, 'Chỉ áp dụng khi trận đua đang diễn ra hoặc đang chờ xác nhận kết quả');
  }
  const draftGuard = await Result.findOne({ raceId: race._id }).select('confirmedAt publishedAt').lean();
  if (draftGuard?.confirmedAt || draftGuard?.publishedAt) {
    throw new HttpError(400, 'Kết quả đã được xác nhận/công bố — không thể lập biên bản mới');
  }

  const rule = await ViolationRule.findById(payload.ruleId);
  if (!rule || !rule.isActive) throw new HttpError(404, 'Luật vi phạm không hợp lệ');

  // Luật phải áp dụng đúng đối tượng (ngựa/nài) đang bị lập biên bản.
  const appliesTo = rule.appliesTo ?? 'both';
  if (appliesTo !== 'both' && appliesTo !== payload.target) {
    const forWhom = appliesTo === 'horse' ? 'ngựa' : 'nài ngựa';
    throw new HttpError(400, `Luật "${rule.name}" chỉ áp dụng cho ${forWhom}.`);
  }

  const participant = race.participants.find((p) =>
    (payload.horseId && p.horseId.toString() === payload.horseId) ||
    (payload.jockeyId && p.jockeyId.toString() === payload.jockeyId)
  );
  if (!participant) throw new HttpError(404, 'Không tìm thấy đối tượng trong trận');

  const isDoping = isDopingRule(rule);
  const isDQ = isDoping || ['disqualify', 'disqualification'].includes(rule.penaltyApplied);
  const isDemote = rule.penaltyApplied === 'demote';
  if (payload.affectedHorseId && !mongoose.isValidObjectId(payload.affectedHorseId)) {
    throw new HttpError(400, 'affectedHorseId không hợp lệ');
  }
  if (payload.affectedHorseId && payload.affectedHorseId === participant.horseId.toString()) {
    throw new HttpError(400, 'Ngựa vi phạm và ngựa bị ảnh hưởng không được trùng nhau');
  }
  const affectedHorseId = payload.affectedHorseId ? new mongoose.Types.ObjectId(payload.affectedHorseId) : null;

  if (isDemote && !affectedHorseId) {
    throw new HttpError(400, 'affectedHorseId là bắt buộc khi áp dụng hình phạt tụt hạng');
  }

  if (isDQ) {
    (participant as any).isDisqualified = true;
    const faultOf = payload.target === 'horse' ? 'Ngựa' : payload.target === 'jockey' ? 'Kỵ sĩ' : 'Cả hai';
    (participant as any).disqualifiedReason = `${rule.name} (Lỗi từ: ${faultOf})`;
    (participant as any).disqualifiedAt = new Date();
    participant.scratchedAt = new Date();
    await race.save();
  }

  let resultDoc = await Result.findOne({ raceId: race._id });
  if (!resultDoc) {
    resultDoc = new Result({ raceId: race._id, tournamentId: race.tournamentId, rankings: [], violations: [], protests: [] });
  }

  if (isDemote && affectedHorseId) {
    applyRelegationToRankings(resultDoc, participant.horseId, affectedHorseId);
  }

  if (isDQ) {
    applyDisqualificationToRankings(resultDoc, participant.horseId);
  }

  const isJockeyPenalty = isDoping || ['jockey', 'both'].includes(payload.target);
  const bannedUntil = rule.banDurationDays > 0
    ? await resolveCompetitionDayBanUntil(rule.banDurationDays, race.scheduledAt)
    : resolvePenaltyBanUntil(rule, isDoping);

  resultDoc.violations.push({
    ruleId: rule._id,
    target: payload.target,
    horseId: participant.horseId,
    jockeyId: participant.jockeyId,
    ownerId: participant.ownerId,
    affectedHorseId,
    type: isDoping ? 'doping' : rule.category,
    description: payload.notes ? `${rule.name} - Ghi chú: ${payload.notes}` : rule.description,
    penaltyApplied: rule.penaltyApplied,
    bannedUntil,
    recordedAt: new Date(),
  } as any);

  let savedResult;
  try {
    savedResult = await resultDoc.save();
  } catch (err) {
    throw mapResultSaveError(err);
  }

  const isBannedPenalty = isDoping || ['time_ban', 'permanent_ban'].includes(rule.penaltyApplied);

  if (isBannedPenalty) {
    const latestViolationId = savedResult.violations[savedResult.violations.length - 1]?._id;
    const banReason = payload.notes ? `${rule.name} - ${payload.notes}` : rule.name;

    if ((isDoping || ['horse', 'both'].includes(payload.target)) && participant.horseId) {
      await Horse.findByIdAndUpdate(participant.horseId, {
        $set: {
          penaltyStatus: {
            isBanned: true,
            bannedUntil: bannedUntil,
            currentViolationId: latestViolationId,
            reason: banReason
          }
        }
      });
    }

    if ((isDoping || ['jockey', 'both'].includes(payload.target)) && participant.jockeyId) {
      await User.findByIdAndUpdate(participant.jockeyId, {
        $set: {
          'jockeyProfile.penaltyStatus': {
            isBanned: true,
            bannedUntil: bannedUntil,
            currentViolationId: latestViolationId,
            reason: banReason
          }
        }
      });
    }

    if (isDoping && participant.ownerId) {
      await User.findByIdAndUpdate(participant.ownerId, {
        $set: {
          penaltyStatus: {
            isBanned: true,
            bannedUntil,
            currentViolationId: latestViolationId,
            reason: banReason
          }
        }
      });
    }
  }

  if (isDQ) {
    const reason = payload.notes ? `${rule.name} - ${payload.notes}` : rule.description;
    const banLine = describeBanDuration(rule, bannedUntil, isBannedPenalty);
    const notices = [];

    if (participant.jockeyId) {
      notices.push({
        userId: participant.jockeyId,
        type: 'disqualification_notice',
        title: 'Thông báo tước quyền thi đấu',
        message: `Bạn bị tước quyền thi đấu vì: ${reason}. ${banLine}.`,
        refModel: 'Result',
        refId: savedResult._id,
      });
    }

    if (participant.ownerId) {
      notices.push({
        userId: participant.ownerId,
        type: 'disqualification_notice',
        title: 'Thông báo tước quyền thi đấu',
        message: `Ngựa của bạn bị tước quyền thi đấu vì: ${reason}. ${banLine}.`,
        refModel: 'Result',
        refId: savedResult._id,
      });
    }

    if (notices.length > 0) {
      await Notification.insertMany(notices);
    }
  }

  if (isJockeyPenalty && !isDQ && participant.jockeyId) {
    const banLine = isBannedPenalty
      ? (rule.banDurationDays > 0
        ? `Án phạt ${rule.banDurationDays} ngày thi đấu thực tế${bannedUntil ? `, hiệu lực đến hết ${bannedUntil.toISOString()}` : ', chờ cập nhật thêm lịch đua để xác định ngày kết thúc'}`
        : 'Án phạt cấm thi đấu không có thời hạn kết thúc tự động')
      : 'Án phạt được ghi nhận vào biên bản, không áp dụng cấm thi đấu.';

    await Notification.create({
      userId: participant.jockeyId,
      type: 'jockey_penalty',
      title: 'Biên bản xử phạt jockey',
      message: `Bạn bị xử phạt vì: ${payload.notes ? `${rule.name} - ${payload.notes}` : rule.description}. ${banLine}.`,
      refModel: 'Result',
      refId: savedResult._id,
    });
  }
}

export async function revokeRacePenalty(
  refereeId: string,
  raceId: string,
  violationId: string
): Promise<void> {
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài phụ trách trận đua này');
  }

  const resultDoc = await Result.findOne({ raceId: race._id });
  if (!resultDoc) throw new HttpError(404, 'Chưa có biên bản kết quả nào được ghi nhận');
  if (resultDoc.confirmedAt || resultDoc.publishedAt) {
    throw new HttpError(400, 'Không thể hoàn tác khi kết quả đã được xác nhận/công bố');
  }

  const violationIndex = resultDoc.violations.findIndex(v => v._id?.toString() === violationId);
  if (violationIndex === -1) throw new HttpError(404, 'Không tìm thấy biên bản vi phạm này');

  const violation = resultDoc.violations[violationIndex]!;

  const isDoping = violation.type === 'doping';
  const isDQ = isDoping || ['disqualify', 'disqualification'].includes(violation.penaltyApplied || '');
  if (isDQ) {
    const participant = race.participants.find(p =>
      (violation.horseId && p.horseId.toString() === violation.horseId.toString()) ||
      (violation.jockeyId && p.jockeyId.toString() === violation.jockeyId.toString())
    );

    if (participant) {
      participant.isDisqualified = false;
      participant.disqualifiedReason = undefined;
      participant.disqualifiedAt = null;
      participant.scratchedAt = null;
      await race.save();
    }
  }

  const isBannedPenalty = isDoping || ['time_ban', 'permanent_ban'].includes(violation.penaltyApplied || '');
  if (isBannedPenalty) {
    const resetStatus = {
      isBanned: false,
      bannedUntil: null,
      currentViolationId: null,
      reason: null
    };

    if ((isDoping || ['horse', 'both'].includes(violation.target)) && violation.horseId) {
      await Horse.findByIdAndUpdate(violation.horseId, {
        $set: { penaltyStatus: resetStatus }
      });
    }

    if ((isDoping || ['jockey', 'both'].includes(violation.target)) && violation.jockeyId) {
      await User.findByIdAndUpdate(violation.jockeyId, {
        $set: { 'jockeyProfile.penaltyStatus': resetStatus }
      });
    }

    if (isDoping && violation.ownerId) {
      await User.findByIdAndUpdate(violation.ownerId, {
        $set: { penaltyStatus: resetStatus }
      });
    }
  }

  resultDoc.violations.splice(violationIndex, 1);
  await resultDoc.save();
}

// ─── Luồng trọng tài điều khiển + xử phạt ────────────────────────────────────

export interface ViolationRuleDto {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  penaltyApplied: string;
  banDurationDays: number;
  appliesTo: 'horse' | 'jockey' | 'both';
}

export interface RaceViolationDto {
  id: string;
  ruleId: string | null;
  type: string;
  description: string;
  penaltyApplied: string | null;
  target: 'horse' | 'jockey' | 'both';
  horseId: string | null;
  horseName: string | null;
  ownerId: string | null;
  affectedHorseId: string | null;
  affectedHorseName: string | null;
  jockeyId: string | null;
  jockeyName: string | null;
  bannedUntil: string | null;
  recordedAt: string;
}

/** Trọng tài bắt đầu điều hành: bốc thăm làn và đưa cuộc đua mình phụ trách sang 'ready'. */
export async function startRefereeRace(refereeId: string, raceId: string): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }
  if (race.status === 'ready') return;
  if (race.status === 'ongoing') return;
  if (race.status !== 'scheduled') {
    throw new HttpError(409, 'Chỉ có thể bắt đầu cuộc đua đang ở trạng thái chờ');
  }
  if (activeParticipants(race.participants).length < 2) {
    throw new HttpError(409, 'Cần ít nhất 2 ngựa trong đường đua để bắt đầu cuộc đua');
  }
  race.participants = randomizeActiveParticipantLanes(race.participants);
  race.status = 'ready';
  await race.save(); // model yêu cầu ≥2 ngựa đang thi đấu
}

/** Danh sách luật vi phạm đang active để trọng tài chọn khi lập biên bản. */
export async function listActiveViolationRules(): Promise<ViolationRuleDto[]> {
  const rules = await ViolationRule.find({ isActive: true })
    .sort({ category: 1, code: 1 })
    .lean();
  return rules.map((r) => ({
    id: r._id.toString(),
    code: r.code,
    name: r.name,
    description: r.description,
    category: r.category,
    severity: r.severity,
    penaltyApplied: r.penaltyApplied,
    banDurationDays: r.banDurationDays,
    appliesTo: r.appliesTo ?? 'both',
  }));
}

/** Liệt kê các biên bản vi phạm của một cuộc đua (kèm tên ngựa/nài). */
export async function listRaceViolations(
  refereeId: string,
  raceId: string,
): Promise<RaceViolationDto[]> {
  if (!mongoose.isValidObjectId(raceId)) throw new HttpError(400, 'ID cuộc đua không hợp lệ');

  const race = await Race.findById(raceId)
    .populate('participants.horseId', 'name')
    .populate('participants.jockeyId', 'fullName')
    .lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }

  const horseNames = new Map<string, string>();
  const jockeyNames = new Map<string, string>();
  for (const p of race.participants) {
    const horse = p.horseId as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
    const jockey = p.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string } | null;
    if (horse?._id) horseNames.set(horse._id.toString(), horse.name);
    if (jockey?._id) jockeyNames.set(jockey._id.toString(), jockey.fullName);
  }

  const result = await Result.findOne({ raceId: race._id }).lean();
  if (!result) return [];

  return result.violations.map((v) => {
    const horseId = v.horseId?.toString() ?? null;
    const ownerId = v.ownerId?.toString() ?? null;
    const affectedHorseId = v.affectedHorseId?.toString() ?? null;
    const jockeyId = v.jockeyId?.toString() ?? null;
    return {
      id: v._id?.toString() ?? '',
      ruleId: v.ruleId?.toString() ?? null,
      type: v.type,
      description: v.description,
      penaltyApplied: v.penaltyApplied ?? null,
      target: v.target,
      horseId,
      horseName: horseId ? horseNames.get(horseId) ?? null : null,
      ownerId,
      affectedHorseId,
      affectedHorseName: affectedHorseId ? horseNames.get(affectedHorseId) ?? null : null,
      jockeyId,
      jockeyName: jockeyId ? jockeyNames.get(jockeyId) ?? null : null,
      bannedUntil: v.bannedUntil?.toISOString() ?? null,
      recordedAt: v.recordedAt.toISOString(),
    };
  });
}

