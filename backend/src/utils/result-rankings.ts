import type { IParticipant } from '../models/Race.model.js';
import type { IRanking } from '../models/Result.model.js';
import type { PenaltyApplied } from '../types/shared.types.js';

export function validateRankings(
  rankings: IRanking[],
  participants: IParticipant[],
  _disqualifiedHorseIds: Set<string>,
): string | null {
  const eligible = participants.filter((p) => !p.scratchedAt || p.isDisqualified);

  if (rankings.length === 0) return null;
  if (rankings.length > eligible.length) {
    return 'Số lượng xếp hạng vượt quá số ngựa đủ điều kiện thi đấu (có thể do ngựa đã bị xử phạt cấm quyền thi đấu)';
  }

  // Khắc phục lỗi Đồng hạng (Dead Heat)
  const ranks = rankings.map((r) => r.rank).sort((a, b) => a - b);
  if (ranks[0] !== 1) {
    return 'Thứ hạng phải bắt đầu từ 1';
  }
  
  for (let i = 1; i < ranks.length; i++) {
    const currentRank = ranks[i]!;
    const previousRank = ranks[i - 1]!;
    if (currentRank < previousRank || currentRank > i + 1) {
      return `Thứ hạng không hợp lệ (lỗi tại rank ${currentRank}). Hãy kiểm tra lại logic đồng hạng.`;
    }
  }

  const participantHorseIds = new Set(eligible.map((p) => p.horseId.toString()));
  const rankHorseIds = new Set<string>();

  for (const r of rankings) {
    const horseKey = r.horseId.toString();
    if (!participantHorseIds.has(horseKey)) {
      return `Ngựa có ID ${horseKey} không nằm trong danh sách thi đấu hợp lệ`;
    }
    if (rankHorseIds.has(horseKey)) {
      return `Trùng lặp kết quả cho ngựa có ID ${horseKey}`;
    }
    rankHorseIds.add(horseKey);
  }

  return null;
}

export function disqualifiedHorseIdsFromViolations(
  violations: { 
    horseId?: { toString(): string } | null; 
    penaltyApplied?: string | null 
  }[],
): Set<string> {
  const ids = new Set<string>();
  for (const v of violations) {
    // Cảnh cáo vẫn được nhận thưởng. Từ hủy kết quả trở lên thì ngựa bị loại
    // khỏi xếp hạng nhận thưởng của riêng cuộc đua đó.
    if (
      ['result_void', 'time_ban', 'permanent_ban', 'disqualify', 'disqualification'].includes(v.penaltyApplied ?? '') &&
      v.horseId
    ) {
      ids.add(v.horseId.toString());
    }
  }
  return ids;
}

export const PENALTY_AFFECTS_RANKING: PenaltyApplied[] = ['result_void', 'time_ban', 'permanent_ban'];
