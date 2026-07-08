import type { IParticipant } from '../models/Race.model.js';

/** Ngựa/kỵ sĩ còn thi đấu (chưa scratch). */
export function activeParticipants(participants: IParticipant[]): IParticipant[] {
  return participants.filter((p) => !p.scratchedAt);
}

export function validateParticipants(
  participants: IParticipant[],
  maxParticipants: number,
  requireAssignedLanes = false,
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

    if (p.laneNumber === undefined || p.laneNumber === null) {
      if (requireAssignedLanes) return 'laneNumber is required for active participants';
      continue;
    }

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
  const assigned = activeParticipants(participants)
    .map((p) => p.laneNumber)
    .filter((lane): lane is number => lane !== undefined && lane !== null);
  if (assigned.length === 0) return 1;
  return Math.max(...assigned) + 1;
}

export function randomLaneNumber(participants: IParticipant[], maxParticipants: number): number {
  const usedLanes = new Set(
    activeParticipants(participants)
      .map((p) => p.laneNumber)
      .filter((lane): lane is number => lane !== undefined && lane !== null),
  );
  const availableLanes: number[] = [];

  for (let lane = 1; lane <= maxParticipants; lane++) {
    if (!usedLanes.has(lane)) availableLanes.push(lane);
  }

  if (availableLanes.length === 0) {
    return nextLaneNumber(participants);
  }

  const index = Math.floor(Math.random() * availableLanes.length);
  return availableLanes[index]!;
}

export function randomizeActiveParticipantLanes(participants: IParticipant[]): IParticipant[] {
  const active = activeParticipants(participants);
  const lanes = Array.from({ length: active.length }, (_, index) => index + 1);

  for (let index = lanes.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [lanes[index], lanes[randomIndex]] = [lanes[randomIndex]!, lanes[index]!];
  }

  active.forEach((participant, index) => {
    const lane = lanes[index]!;
    participant.laneNumber = lane;
    participant.clothNumber = lane;
  });

  return participants;
}
