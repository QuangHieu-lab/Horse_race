import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { User } from '../models/User.model.js';
import { Horse } from '../models/Horse.model.js';
import { HttpError } from '../utils/http-error.js';
import { ViolationRule } from '../models/ViolationRule.model.js';
import { activeParticipants } from '../utils/race-participants.js';
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
  jockeyId: string;
  jockeyName: string;
  ownerId: string;
  laneNumber: number;
  vetApproved: boolean;
  confirmed: boolean;
}

export interface ApplyTimePenaltyInput {
  horseId: string;
  jockeyId: string;
  addedTimeSeconds: number;
  ruleId?: string;
  type: string;
  description: string;
}

export async function getRefereeDashboard(refereeId: string) {
  const objectId = new mongoose.Types.ObjectId(refereeId);
  const [upcoming, completed, pendingConfirm] = await Promise.all([
    Race.countDocuments({ refereeId: objectId, status: { $in: ['scheduled', 'ongoing'] } }),
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
    .populate('participants.horseId', 'name')
    .populate('participants.jockeyId', 'fullName')
    .lean();

  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }

  return race.participants.map((p) => {
    const horse = p.horseId as unknown as { _id: mongoose.Types.ObjectId; name: string };
    const jockey = p.jockeyId as unknown as { _id: mongoose.Types.ObjectId; fullName: string };
    return {
      raceId: race._id.toString(),
      raceName: race.name,
      horseId: horse._id.toString(),
      horseName: horse.name,
      jockeyId: jockey._id.toString(),
      jockeyName: jockey.fullName,
      ownerId: p.ownerId.toString(),
      laneNumber: p.laneNumber,
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

  race.status = 'completed';
  try {
    await race.save();
  } catch (err) {
    throw new HttpError(500, err instanceof Error ? err.message : 'Lỗi khi lưu trận đua');
  }

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

export async function buildResultFromRace(raceId: string, refereeId: string) {
  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
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
  payload: { ruleId: string; target: 'horse' | 'jockey' | 'both'; horseId?: string; jockeyId?: string; notes?: string; }
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

  const participant = race.participants.find((p) =>
    (payload.horseId && p.horseId.toString() === payload.horseId) ||
    (payload.jockeyId && p.jockeyId.toString() === payload.jockeyId)
  );
  if (!participant) throw new HttpError(404, 'Không tìm thấy đối tượng trong trận');

  const isDQ = ['disqualify', 'disqualification'].includes(rule.penaltyApplied);
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

  let bannedUntil: Date | null = null;
  if (rule.penaltyApplied === 'time_ban' && rule.banDurationDays > 0) {
    bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + rule.banDurationDays);
  }

  resultDoc.violations.push({
    ruleId: rule._id,
    target: payload.target,
    horseId: participant.horseId,
    jockeyId: participant.jockeyId,
    type: rule.category,
    description: payload.notes ? `${rule.name} - Ghi chú: ${payload.notes}` : rule.description,
    penaltyApplied: rule.penaltyApplied,
    bannedUntil,
    recordedAt: new Date(),
  });

  const savedResult = await resultDoc.save();

  const isBannedPenalty = ['time_ban', 'permanent_ban'].includes(rule.penaltyApplied);

  if (isBannedPenalty) {
    const latestViolationId = savedResult.violations[savedResult.violations.length - 1]?._id;
    const banReason = payload.notes ? `${rule.name} - ${payload.notes}` : rule.name;

    if (['horse', 'both'].includes(payload.target) && participant.horseId) {
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

    if (['jockey', 'both'].includes(payload.target) && participant.jockeyId) {
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

  const isDQ = ['disqualify', 'disqualification'].includes(violation.penaltyApplied || '');
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

  const isBannedPenalty = ['time_ban', 'permanent_ban'].includes(violation.penaltyApplied || '');
  if (isBannedPenalty) {
    const resetStatus = {
      isBanned: false,
      bannedUntil: null,
      currentViolationId: null,
      reason: null
    };

    if (['horse', 'both'].includes(violation.target) && violation.horseId) {
      await Horse.findByIdAndUpdate(violation.horseId, {
        $set: { penaltyStatus: resetStatus }
      });
    }

    if (['jockey', 'both'].includes(violation.target) && violation.jockeyId) {
      await User.findByIdAndUpdate(violation.jockeyId, {
        $set: { 'jockeyProfile.penaltyStatus': resetStatus }
      });
    }
  }

  resultDoc.violations.splice(violationIndex, 1);
  await resultDoc.save();
}

export async function applyViolationAndTimePenalty(raceId: string, input: ApplyTimePenaltyInput) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const result = await Result.findOne({ raceId: new mongoose.Types.ObjectId(raceId) });

  if (!result) {
    throw new HttpError(404, 'Không tìm thấy kết quả của trận đua này');
  }
  if (result.confirmedAt) {
    throw new HttpError(400, 'Không thể sửa đổi vì kết quả trận đấu đã được xác nhận');
  }

  result.violations.push({
    ruleId: input.ruleId ? new mongoose.Types.ObjectId(input.ruleId) : null,
    horseId: new mongoose.Types.ObjectId(input.horseId),
    jockeyId: new mongoose.Types.ObjectId(input.jockeyId),
    target: 'horse',
    type: input.type,
    description: `[Phạt cộng ${input.addedTimeSeconds}s] ${input.description}`,
    recordedAt: new Date()
  } as any);

  const targetRanking = result.rankings.find(r => r.horseId.toString() === input.horseId);
  if (!targetRanking || targetRanking.finishTime === undefined) {
    throw new HttpError(400, 'Ngựa này không có thời gian hoàn thành hợp lệ trong kết quả');
  }

  targetRanking.finishTime += input.addedTimeSeconds;
  targetRanking.finishTime = parseFloat(targetRanking.finishTime.toFixed(3));

  result.rankings.sort((a, b) => (a.finishTime || 0) - (b.finishTime || 0));

  result.rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;

    if (index === 0) {
      ranking.marginBehind = 0;
      ranking.isDeadHeat = false;
    } else {
      const prevTime = result.rankings[index - 1]?.finishTime ?? 0;
      const currentTime = ranking.finishTime ?? 0;

      ranking.marginBehind = parseFloat((currentTime - prevTime).toFixed(3));
      ranking.isDeadHeat = ranking.marginBehind === 0;
    }
  });

  await result.save();

  return result;
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
  jockeyId: string | null;
  jockeyName: string | null;
  bannedUntil: string | null;
  recordedAt: string;
}

/** Trọng tài bắt đầu điều hành: đưa cuộc đua mình phụ trách sang 'ongoing'. */
export async function startRefereeRace(refereeId: string, raceId: string): Promise<void> {
  if (!mongoose.isValidObjectId(raceId)) throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.refereeId?.toString() !== refereeId) {
    throw new HttpError(403, 'Bạn không phải trọng tài cuộc đua này');
  }
  if (race.status === 'ongoing') return; // đã chạy rồi thì bỏ qua
  if (race.status !== 'scheduled') {
    throw new HttpError(409, 'Chỉ có thể bắt đầu cuộc đua đang ở trạng thái chờ');
  }
  if (activeParticipants(race.participants).length < 2) {
    throw new HttpError(409, 'Cần ít nhất 2 ngựa trong đường đua để bắt đầu cuộc đua');
  }
  race.status = 'ongoing';
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
      jockeyId,
      jockeyName: jockeyId ? jockeyNames.get(jockeyId) ?? null : null,
      bannedUntil: v.bannedUntil?.toISOString() ?? null,
      recordedAt: v.recordedAt.toISOString(),
    };
  });
}