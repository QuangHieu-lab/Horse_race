import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { Horse } from '../models/Horse.model.js';
import { HttpError } from '../utils/http-error.js';
import { ViolationRule } from '../models/ViolationRule.model.js';
import { Notification } from '../models/Notification.model.js';
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

// Mức độ vi phạm → số bậc bị tụt (nhẹ 1 · trung bình 2 · nặng 3 · rất nặng 5).
const SEVERITY_DEMOTE_RANKS: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 5 };
function demoteRanksForSeverity(severity: string): number {
  return SEVERITY_DEMOTE_RANKS[severity] ?? 2;
}

type RankingRow = { horseId: mongoose.Types.ObjectId; rank: number; finishTime?: number; marginBehind?: number; isDeadHeat?: boolean };

// Tụt ngựa vi phạm xuống `drop` bậc trong bảng xếp hạng (tràn khỏi bảng thì xếp cuối).
// Trả về hạng mới (1-based) của ngựa.
function applyDemoteBySeverity(
  result: { rankings: RankingRow[] },
  penalizedHorseId: mongoose.Types.ObjectId,
  drop: number,
): number {
  const idx = result.rankings.findIndex((r) => r.horseId.toString() === penalizedHorseId.toString());
  if (idx === -1) {
    throw new HttpError(400, 'Ngựa vi phạm không có trong bảng xếp hạng để tụt bậc');
  }
  const [penalized] = result.rankings.splice(idx, 1);
  if (!penalized) throw new HttpError(500, 'Không thể tụt hạng ngựa vi phạm');
  const target = Math.min(idx + Math.max(1, drop), result.rankings.length);
  result.rankings.splice(target, 0, penalized);
  refreshRankingOrder(result);
  return target + 1;
}

// Dựng lại bảng xếp hạng thuần từ (thời gian về đích + tập án tụt bậc hiện có):
// sắp theo finishTime rồi áp lần lượt các án tụt bậc theo thứ tự lập biên bản.
// Nhờ vậy việc HOÀN TÁC một án chỉ cần xoá án đó rồi gọi lại hàm này.
async function recomputeRankingsWithDemotions(result: {
  rankings: RankingRow[];
  violations: Array<{ penaltyApplied?: string | null; horseId?: mongoose.Types.ObjectId | null; ruleId?: mongoose.Types.ObjectId | null; recordedAt: Date }>;
}): Promise<void> {
  result.rankings.sort((a, b) => (a.finishTime ?? Number.POSITIVE_INFINITY) - (b.finishTime ?? Number.POSITIVE_INFINITY));
  refreshRankingOrder(result);

  const demotes = result.violations
    .filter((v) => v.penaltyApplied === 'demote' && v.horseId)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  if (demotes.length === 0) return;

  const ruleIds = [...new Set(demotes.map((v) => v.ruleId?.toString()).filter(Boolean))];
  const rules = await ViolationRule.find({ _id: { $in: ruleIds } }).select('severity').lean();
  const sevById = new Map(rules.map((r) => [r._id.toString(), r.severity]));

  for (const v of demotes) {
    const sev = v.ruleId ? sevById.get(v.ruleId.toString()) : undefined;
    const drop = demoteRanksForSeverity(sev ?? 'medium');
    try {
      applyDemoteBySeverity(result, v.horseId!, drop);
    } catch {
      // Ngựa không còn trong bảng (đã bị xoá) thì bỏ qua án này.
    }
  }
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
  payload: { ruleId: string; target: 'horse' | 'jockey'; horseId?: string; jockeyId?: string; notes?: string; }
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

  // Hình phạt đơn giản & thống nhất: tụt bậc theo mức độ vi phạm
  // (nhẹ 1 · trung bình 2 · nặng 3 · rất nặng 5). Tràn khỏi bảng thì xếp cuối.
  const drop = demoteRanksForSeverity(rule.severity);

  const resultDoc = await Result.findOne({ raceId: race._id });
  if (!resultDoc || resultDoc.rankings.length === 0) {
    throw new HttpError(400, 'Chưa có kết quả để phạt — hãy chạy đua tạo bảng xếp hạng trước khi lập biên bản.');
  }

  const oldRank = resultDoc.rankings.find(
    (r) => r.horseId.toString() === participant.horseId.toString(),
  )?.rank ?? null;
  if (oldRank === null) {
    throw new HttpError(400, 'Ngựa/nài này không có trong bảng xếp hạng cuộc đua.');
  }

  resultDoc.violations.push({
    ruleId: rule._id,
    target: payload.target,
    horseId: participant.horseId,
    jockeyId: participant.jockeyId,
    affectedHorseId: null,
    type: rule.category,
    description: `${rule.name} — tụt ${drop} bậc${payload.notes ? ` · ${payload.notes}` : ''}`,
    penaltyApplied: 'demote',
    bannedUntil: null,
    recordedAt: new Date(),
  } as any);

  // Dựng lại bảng xếp hạng từ tập án hiện có (gồm cả án vừa thêm).
  await recomputeRankingsWithDemotions(resultDoc);
  const newRank = resultDoc.rankings.find(
    (r) => r.horseId.toString() === participant.horseId.toString(),
  )?.rank ?? oldRank;
  // Ghi hạng cũ→mới vào mô tả biên bản vừa lập.
  const lastViolation = resultDoc.violations[resultDoc.violations.length - 1] as any;
  lastViolation.description = `${rule.name} — tụt ${drop} bậc (hạng ${oldRank}→${newRank})${payload.notes ? ` · ${payload.notes}` : ''}`;

  let savedResult;
  try {
    savedResult = await resultDoc.save();
  } catch (err) {
    throw mapResultSaveError(err);
  }

  // Thông báo cho người bị lập biên bản:
  // - phạt nài  → thông báo cho chính nài ngựa;
  // - phạt ngựa → thông báo cho chủ ngựa (người quản lý ngựa).
  await notifyPenaltyParties({
    race,
    target: payload.target,
    jockeyId: participant.jockeyId,
    ownerId: participant.ownerId,
    horseId: participant.horseId,
    title: 'Bạn có biên bản vi phạm mới',
    detail: `Luật: ${rule.name} — tụt ${drop} bậc (còn hạng ${newRank})${payload.notes ? ` — Ghi chú: ${payload.notes}` : ''}`,
    type: 'penalty_issued',
    resultId: savedResult._id,
  });
}

async function notifyPenaltyParties(input: {
  race: { _id: mongoose.Types.ObjectId; name: string };
  target: 'horse' | 'jockey';
  jockeyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  horseId: mongoose.Types.ObjectId;
  title: string;
  detail: string;
  type: 'penalty_issued' | 'penalty_revoked';
  resultId: mongoose.Types.ObjectId;
}): Promise<void> {
  try {
    const horse = await Horse.findById(input.horseId).select('name').lean();
    const horseName = horse?.name ?? 'ngựa của bạn';
    const recipientId = input.target === 'jockey' ? input.jockeyId : input.ownerId;
    const message =
      input.target === 'jockey'
        ? `Cuộc đua "${input.race.name}": ${input.detail}`
        : `Cuộc đua "${input.race.name}" — ngựa ${horseName}: ${input.detail}`;

    await Notification.create({
      userId: recipientId,
      type: input.type,
      title: input.title,
      message,
      refModel: 'Result',
      refId: input.resultId,
    });
  } catch (err) {
    // Thông báo là phụ trợ — không làm hỏng nghiệp vụ xử phạt nếu tạo thất bại.
    console.error('notifyPenaltyParties failed:', err);
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

  // Xoá án rồi dựng lại bảng xếp hạng từ các án còn lại → tự khôi phục thứ hạng.
  resultDoc.violations.splice(violationIndex, 1);
  await recomputeRankingsWithDemotions(resultDoc);
  await resultDoc.save();

  // Báo cho người từng bị phạt biết án phạt đã được gỡ.
  const revokedParticipant = race.participants.find(p =>
    (violation.horseId && p.horseId.toString() === violation.horseId.toString()) ||
    (violation.jockeyId && p.jockeyId.toString() === violation.jockeyId.toString())
  );
  if (revokedParticipant) {
    const target: 'horse' | 'jockey' = violation.target === 'jockey' ? 'jockey' : 'horse';
    await notifyPenaltyParties({
      race,
      target,
      jockeyId: revokedParticipant.jockeyId,
      ownerId: revokedParticipant.ownerId,
      horseId: revokedParticipant.horseId,
      title: 'Án phạt đã được hoàn tác',
      detail: `Biên bản "${violation.description}" đã được trọng tài gỡ bỏ.`,
      type: 'penalty_revoked',
      resultId: resultDoc._id,
    });
  }
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
  affectedHorseId: string | null;
  affectedHorseName: string | null;
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
      affectedHorseId,
      affectedHorseName: affectedHorseId ? horseNames.get(affectedHorseId) ?? null : null,
      jockeyId,
      jockeyName: jockeyId ? jockeyNames.get(jockeyId) ?? null : null,
      bannedUntil: v.bannedUntil?.toISOString() ?? null,
      recordedAt: v.recordedAt.toISOString(),
    };
  });
}
