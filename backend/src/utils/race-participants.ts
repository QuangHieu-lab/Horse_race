import type { IParticipant } from '../models/Race.model.js';

/** Ngựa/kỵ sĩ còn thi đấu (chưa scratch). */
export function activeParticipants(participants: IParticipant[]): IParticipant[] {
  return participants.filter((p) => !p.scratchedAt);
}

export function validateParticipants(
  participants: IParticipant[],
  maxParticipants: number,
): string | null {
  if (participants.length > maxParticipants) {
    return `participants exceed maxParticipants (${maxParticipants})`;
  }

  const active = activeParticipants(participants);
  const horseIds = new Set<string>();
  const jockeyIds = new Set<string>();
  const lanes = new Set<number>();
  const cloths = new Set<number>();

  for (const p of active) {
    const horseKey = p.horseId.toString();
    const jockeyKey = p.jockeyId.toString();

    if (horseIds.has(horseKey)) return 'duplicate horseId in active participants';
    if (jockeyIds.has(jockeyKey)) return 'duplicate jockeyId in active participants';
    horseIds.add(horseKey);
    jockeyIds.add(jockeyKey);

    if (p.laneNumber < 1 || p.laneNumber > maxParticipants) {
      return `laneNumber must be between 1 and ${maxParticipants}`;
    }
    if (lanes.has(p.laneNumber)) return 'duplicate laneNumber in active participants';
    lanes.add(p.laneNumber);

    const cloth = p.clothNumber ?? p.laneNumber;
    if (cloths.has(cloth)) return 'duplicate clothNumber in active participants';
    cloths.add(cloth);
  }

  return null;
}

export function nextLaneNumber(participants: IParticipant[]): number {
  const active = activeParticipants(participants);
  if (active.length === 0) return 1;
  return Math.max(...active.map((p) => p.laneNumber)) + 1;
}
