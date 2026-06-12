import type { IViewingTicket } from '../models/Race.model.js';
import { HttpError } from './http-error.js';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export interface ViewingTicketInput {
  enabled?: boolean;
  pricePoints?: number;
  announceAt?: string | Date | null;
  saleOpensAt?: string | Date | null;
  saleExpiresAt?: string | Date | null;
  announcementMessage?: string;
  allowVipRedemption?: boolean;
}

export function parseOptionalDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeViewingTicket(
  scheduledAt: Date,
  input?: ViewingTicketInput | null,
): IViewingTicket {
  const enabled = input?.enabled ?? false;
  const pricePoints = Math.max(0, input?.pricePoints ?? 0);

  if (!enabled) {
    return {
      enabled: false,
      pricePoints: 0,
      announceAt: null,
      saleOpensAt: null,
      saleExpiresAt: null,
      announcementMessage: input?.announcementMessage,
      allowVipRedemption: false,
    };
  }

  const saleExpiresAt =
    parseOptionalDate(input?.saleExpiresAt) ?? new Date(scheduledAt.getTime());
  let announceAt =
    parseOptionalDate(input?.announceAt) ??
    new Date(scheduledAt.getTime() - FIVE_DAYS_MS);
  const saleOpensAt =
    parseOptionalDate(input?.saleOpensAt) ?? announceAt;

  if (announceAt >= saleExpiresAt) {
    announceAt = new Date(saleExpiresAt.getTime() - FIVE_DAYS_MS);
  }

  if (announceAt >= saleExpiresAt) {
    throw new HttpError(400, 'announceAt phải trước saleExpiresAt');
  }

  return {
    enabled: true,
    pricePoints,
    announceAt,
    saleOpensAt,
    saleExpiresAt,
    announcementMessage: input?.announcementMessage,
    allowVipRedemption: input?.allowVipRedemption ?? false,
  };
}

export function isTicketRequired(ticket: IViewingTicket): boolean {
  return ticket.enabled && ticket.pricePoints > 0;
}

export function formatReminderDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
