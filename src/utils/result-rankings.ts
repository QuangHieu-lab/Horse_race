import type { IParticipant } from '../models/Race.model.js';
import { activeParticipants } from './race-participants.js';
import type { IRanking } from '../models/Result.model.js';
import type { PenaltyApplied } from '../types/shared.types.js';

export function validateRankings(
  rankings: IRanking[],
  participants: IParticipant[],
  disqualifiedHorseIds: Set<string>,
): string | null {
  const eligible = activeParticipants(participants).filter(
    (p) => !disqualifiedHorseIds.has(p.horseId.toString()),
  );

  if (rankings.length === 0) return null;
  if (rankings.length > eligible.length) {
    return 'rankings count exceeds eligible participants';
  }

  const ranks = rankings.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return 'rankings must be contiguous starting at 1';
  }

  const participantHorseIds = new Set(eligible.map((p) => p.horseId.toString()));
  const rankHorseIds = new Set<string>();

  for (const r of rankings) {
    const horseKey = r.horseId.toString();
    if (!participantHorseIds.has(horseKey)) {
      return 'ranking horseId must be an eligible race participant';
    }
    if (disqualifiedHorseIds.has(horseKey)) {
      return 'disqualified horse cannot appear in rankings';
    }
    if (rankHorseIds.has(horseKey)) return 'duplicate horseId in rankings';
    rankHorseIds.add(horseKey);
  }

  return null;
}

export function disqualifiedHorseIdsFromViolations(
  violations: { horseId: { toString(): string }; penaltyApplied?: string | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const v of violations) {
    if (v.penaltyApplied === 'disqualify') {
      ids.add(v.horseId.toString());
    }
  }
  return ids;
}

export const PENALTY_AFFECTS_RANKING: PenaltyApplied[] = ['disqualify'];
