import type { PenaltyStatusDto } from '../types/api.types.js';

export interface RawPenaltyStatus {
  isBanned?: boolean;
  bannedUntil?: Date | string | null;
  reason?: string | null;
}

export function isPenaltyActive(status?: RawPenaltyStatus | null): boolean {
  if (!status?.isBanned) return false;
  if (!status.bannedUntil) return true;
  return new Date(status.bannedUntil) > new Date();
}

export function toPenaltyStatusDto(status?: RawPenaltyStatus | null): PenaltyStatusDto {
  const active = isPenaltyActive(status);
  const bannedUntil = status?.bannedUntil ? new Date(status.bannedUntil).toISOString() : null;

  return {
    isBanned: active,
    bannedUntil: active ? bannedUntil : null,
    reason: active ? status?.reason ?? null : null,
  };
}
