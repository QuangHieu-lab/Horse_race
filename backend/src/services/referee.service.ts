import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { User } from '../models/User.model.js';
import { Horse } from '../models/Horse.model.js';
import { HttpError } from '../utils/http-error.js';
import { ViolationRule } from '../models/ViolationRule.model.js';
import { activeParticipants } from '../utils/race-participants.js';
import { simulateRace } from '../services/race.service.js';

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
  jockeyName: string;
  laneNumber: number;
  vetApproved: boolean;
  confirmed: boolean;
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
      jockeyName: jockey.fullName,
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
  // 🚀 Nhận thêm target
  payload: { ruleId: string; target: 'horse' | 'jockey' | 'both'; horseId?: string; jockeyId?: string; notes?: string; }
): Promise<void> {
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');
  if (race.refereeId?.toString() !== refereeId) throw new HttpError(403, 'Không có quyền truy cập');
  if (race.status !== 'ongoing') throw new HttpError(400, 'Chỉ áp dụng khi trận đua đang diễn ra');

  const rule = await ViolationRule.findById(payload.ruleId);
  if (!rule || !rule.isActive) throw new HttpError(404, 'Luật vi phạm không hợp lệ');

  // Dùng ID để tìm kiếm CẶP THI ĐẤU trên sân
  const participant = race.participants.find((p) => 
    (payload.horseId && p.horseId.toString() === payload.horseId) || 
    (payload.jockeyId && p.jockeyId.toString() === payload.jockeyId)
  );
  if (!participant) throw new HttpError(404, 'Không tìm thấy đối tượng trong trận');

  // Xử lý tước quyền thi đấu (Nếu 1 trong 2 bị tước quyền, cả cặp phải rời sân)
  const isDQ = ['disqualify', 'disqualification'].includes(rule.penaltyApplied);
  if (isDQ) {
    (participant as any).isDisqualified = true;
    // Ghi rõ bị tước quyền do lỗi của ai
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

  // Đẩy vi phạm vào mảng (Luôn ghi lại thông tin cả cặp, nhưng target chỉ đích danh người có tội)
  resultDoc.violations.push({
    ruleId: rule._id,
    target: payload.target, // 🚀 Lưu lại cờ target
    horseId: participant.horseId, 
    jockeyId: participant.jockeyId,
    type: rule.category,
    description: payload.notes ? `${rule.name} - Ghi chú: ${payload.notes}` : rule.description,
    penaltyApplied: rule.penaltyApplied,
    bannedUntil,
    recordedAt: new Date(),
  });

  const savedResult = await resultDoc.save();

  // =====================================================================
  // 🚀 ĐỒNG BỘ TRẠNG THÁI CHÍNH XÁC THEO TARGET (PHẠT ĐÚNG NGƯỜI, ĐÚNG TỘI)
  // =====================================================================
  
  const isBannedPenalty = ['time_ban', 'permanent_ban'].includes(rule.penaltyApplied);
  
  if (isBannedPenalty) {
    const latestViolationId = savedResult.violations[savedResult.violations.length - 1]?._id;
    const banReason = payload.notes ? `${rule.name} - ${payload.notes}` : rule.name;

    // 1. Chỉ phạt Ngựa nếu target là 'horse' hoặc 'both'
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

    // 2. Chỉ phạt Kỵ sĩ nếu target là 'jockey' hoặc 'both'
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
  if (race.status === 'completed') {
    throw new HttpError(400, 'Không thể hoàn tác án phạt khi trận đua đã kết thúc');
  }

  const resultDoc = await Result.findOne({ raceId: race._id });
  if (!resultDoc) throw new HttpError(404, 'Chưa có biên bản kết quả nào được ghi nhận');

  // 1. Tìm lỗi vi phạm cần xóa trong mảng violations
  const violationIndex = resultDoc.violations.findIndex(v => v._id?.toString() === violationId);
  if (violationIndex === -1) throw new HttpError(404, 'Không tìm thấy biên bản vi phạm này');

  const violation = resultDoc.violations[violationIndex]!;

  // 2. Khôi phục trạng thái tham gia trận đua (nếu lỗi đó là lỗi tước quyền)
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
      participant.scratchedAt = null; // Cho phép quay lại đường đua hợp lệ
      await race.save();
    }
  }

  // 3. Giải phóng tài khoản gốc dựa trên biến 'target' (TRÁNH GỠ ÁN OAN CHO ĐỐI TƯỢNG KHÁC)
  const isBannedPenalty = ['time_ban', 'permanent_ban'].includes(violation.penaltyApplied || '');
  if (isBannedPenalty) {
    const resetStatus = {
      isBanned: false,
      bannedUntil: null,
      currentViolationId: null,
      reason: null
    };

    // CHỈ gỡ lệnh cấm trên Horse nếu target ban đầu của biên bản này có nhắm vào Horse
    if (['horse', 'both'].includes(violation.target) && violation.horseId) {
      await Horse.findByIdAndUpdate(violation.horseId, {
        $set: { penaltyStatus: resetStatus }
      });
    }

    // CHỈ gỡ lệnh cấm trên Jockey nếu target ban đầu của biên bản này có nhắm vào Jockey
    if (['jockey', 'both'].includes(violation.target) && violation.jockeyId) {
      await User.findByIdAndUpdate(violation.jockeyId, {
        $set: { 'jockeyProfile.penaltyStatus': resetStatus }
      });
    }
  }

  // 4. Xóa vi phạm khỏi danh sách của Result và lưu biên bản tổng
  resultDoc.violations.splice(violationIndex, 1);
  await resultDoc.save();
}
export interface ApplyTimePenaltyInput {
  horseId: string;
  jockeyId: string;
  addedTimeSeconds: number; // Số giây bị cộng thêm (VD: 5.5)
  ruleId?: string; // Trỏ tới luật vi phạm (tùy chọn)
  type: string; // Loại vi phạm (VD: 'race_conduct')
  description: string; // Lời phê của Trọng tài
}

export async function applyViolationAndTimePenalty(raceId: string, input: ApplyTimePenaltyInput) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  // 1. Lấy bản nháp kết quả hiện tại
  const result = await Result.findOne({ raceId: new mongoose.Types.ObjectId(raceId) });
  
  if (!result) {
    throw new HttpError(404, 'Không tìm thấy kết quả của trận đua này');
  }
  if (result.confirmedAt) {
    throw new HttpError(400, 'Không thể sửa đổi vì kết quả trận đấu đã được xác nhận');
  }

  // 2. Ghi chép lịch sử vi phạm vào mảng violations
  result.violations.push({
    ruleId: input.ruleId ? new mongoose.Types.ObjectId(input.ruleId) : null,
    horseId: new mongoose.Types.ObjectId(input.horseId),
    jockeyId: new mongoose.Types.ObjectId(input.jockeyId),
    target: 'horse',
    type: input.type,
    description: `[Phạt cộng ${input.addedTimeSeconds}s] ${input.description}`,
    recordedAt: new Date()
  } as any);

  // 3. Tìm ngựa bị phạt và cộng thêm thời gian
  const targetRanking = result.rankings.find(r => r.horseId.toString() === input.horseId);
  if (!targetRanking || targetRanking.finishTime === undefined) {
    throw new HttpError(400, 'Ngựa này không có thời gian hoàn thành hợp lệ trong kết quả');
  }
  
  // Cộng thời gian phạt vào thành tích thực tế
  targetRanking.finishTime += input.addedTimeSeconds;
  targetRanking.finishTime = parseFloat(targetRanking.finishTime.toFixed(3)); // Giữ 3 chữ số thập phân

  // 4. SẮP XẾP VÀ CẬP NHẬT LẠI TOÀN BỘ THỨ HẠNG
  // Do bị cộng thêm giây, con ngựa này có thể rơi từ Top 1 xuống Top 3
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
      ranking.isDeadHeat = ranking.marginBehind === 0; // Nếu bằng thời gian nhau thì đánh dấu hòa
    }
  });

  // 5. Lưu lại bản cập nhật
  await result.save();
  
  return result;
}
