import type { IParticipant } from '../models/Race.model.js';

/** Ngựa/kỵ sĩ còn thi đấu (chưa scratch và chưa bị DQ). */
export function activeParticipants(participants: IParticipant[]): IParticipant[] {
  return participants.filter((p) => !p.scratchedAt && !p.isDisqualified);
}

export function validateParticipants(
  participants: IParticipant[],
  maxParticipants: number,
  requireAssignedLanes = false,
): string | null {
  if (participants.length > maxParticipants) {
    return `Số ngựa tham gia vượt quá giới hạn tối đa (${maxParticipants})`;
  }

  const active = activeParticipants(participants);
  const horseIds = new Set<string>();
  const jockeyIds = new Set<string>();
  const lanes = new Set<number>();
  const cloths = new Set<number>();

  for (const p of active) {
    const horseKey = p.horseId.toString();
    const jockeyKey = p.jockeyId.toString();

    if (horseIds.has(horseKey)) return 'Trùng ngựa trong danh sách thi đấu';
    if (jockeyIds.has(jockeyKey)) return 'Trùng nài ngựa trong danh sách thi đấu';
    horseIds.add(horseKey);
    jockeyIds.add(jockeyKey);

    if (p.laneNumber === undefined || p.laneNumber === null) {
      if (requireAssignedLanes) return 'Ngựa đang thi đấu phải được gán làn chạy';
      continue;
    }

    if (p.laneNumber < 1 || p.laneNumber > maxParticipants) {
      return `Số làn chạy phải nằm trong khoảng 1 đến ${maxParticipants}`;
    }
    if (lanes.has(p.laneNumber)) return 'Trùng số làn chạy trong danh sách thi đấu';
    lanes.add(p.laneNumber);

    const cloth = p.clothNumber ?? p.laneNumber;
    if (cloths.has(cloth)) return 'Trùng số áo trong danh sách thi đấu';
    cloths.add(cloth);
  }

  return null;
}

export function validatePreRaceChecks(participants: IParticipant[]): string | null {
  const active = activeParticipants(participants);
  const missingVet = active.filter((p) => !p.vetApprovedAt);
  if (missingVet.length > 0) {
    return 'Tất cả ngựa đang thi đấu phải đạt kiểm tra thú y trước khi bắt đầu cuộc đua';
  }

  const missingConfirmation = active.filter((p) => !p.confirmedAt);
  if (missingConfirmation.length > 0) {
    return 'Tất cả ngựa đang thi đấu phải được xác nhận thông tin trước khi bắt đầu cuộc đua';
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
