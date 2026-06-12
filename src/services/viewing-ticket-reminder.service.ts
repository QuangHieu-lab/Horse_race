import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Race } from '../models/Race.model.js';
import { RaceViewingPass } from '../models/RaceViewingPass.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { ViewingTicketReminderLog } from '../models/ViewingTicketReminderLog.model.js';
import { formatReminderDate } from '../utils/viewing-ticket.js';

export interface ReminderJobResult {
  racesProcessed: number;
  notificationsCreated: number;
  skippedDuplicates: number;
}

async function notifyIfNew(
  userId: mongoose.Types.ObjectId,
  raceId: mongoose.Types.ObjectId,
  reminderDate: string,
  kind: 'sale_open' | 'daily_reminder' | 'purchased_reminder',
  title: string,
  message: string,
  refId?: mongoose.Types.ObjectId,
): Promise<boolean> {
  try {
    await ViewingTicketReminderLog.create({
      userId,
      raceId,
      reminderDate,
      kind,
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
      return false;
    }
    throw err;
  }

  await Notification.create({
    userId,
    type:
      kind === 'sale_open'
        ? 'viewing_ticket_sale_open'
        : 'viewing_ticket_daily_reminder',
    title,
    message,
    refModel: 'Race',
    refId: refId ?? raceId,
  });
  return true;
}

function daysUntil(date: Date, now: Date): number {
  const ms = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export async function processDailyViewingReminders(
  now: Date = new Date(),
): Promise<ReminderJobResult> {
  const reminderDate = formatReminderDate(now);
  let notificationsCreated = 0;
  let skippedDuplicates = 0;

  const races = await Race.find({
    'viewingTicket.enabled': true,
    'viewingTicket.pricePoints': { $gt: 0 },
    status: 'scheduled',
    'viewingTicket.announceAt': { $lte: now },
    'viewingTicket.saleExpiresAt': { $gt: now },
  }).lean();

  const profiles = await SpectatorProfile.find().select('userId').lean();
  const spectatorIds = profiles.map((p) => p.userId);

  for (const race of races) {
    const vt = race.viewingTicket;
    const announceAt = vt.announceAt!;
    const saleExpiresAt = vt.saleExpiresAt!;

    const daysLeft = daysUntil(saleExpiresAt, now);
    const priceLine = `${vt.pricePoints} điểm`;
    const scheduleLine = new Date(race.scheduledAt).toLocaleString('vi-VN');
    const detailBlock = vt.announcementMessage
      ? `${vt.announcementMessage}\n\n`
      : '';

    for (const userId of spectatorIds) {
      const hasPass = await RaceViewingPass.exists({
        spectatorId: userId,
        raceId: race._id,
        status: 'active',
      });

      if (!hasPass) {
        const isFirstSaleDay = formatReminderDate(announceAt) === reminderDate;
        const kind = isFirstSaleDay ? 'sale_open' : 'daily_reminder';
        const title = isFirstSaleDay
          ? `Mở bán vé xem: ${race.name}`
          : `Nhắc mua vé: ${race.name}`;
        const message = isFirstSaleDay
          ? `${detailBlock}Vé xem cuộc đua "${race.name}" đã mở bán với giá ${priceLine}. Giờ đua: ${scheduleLine}. Hết hạn mua vé sau ${daysLeft} ngày.`
          : `Còn ${daysLeft} ngày để mua vé xem "${race.name}" (${priceLine}). Giờ đua: ${scheduleLine}.`;

        const created = await notifyIfNew(
          userId,
          race._id,
          reminderDate,
          kind,
          title,
          message,
        );
        if (created) notificationsCreated++;
        else skippedDuplicates++;
      } else if (daysLeft > 0) {
        const created = await notifyIfNew(
          userId,
          race._id,
          reminderDate,
          'purchased_reminder',
          `Sắp diễn ra: ${race.name}`,
          `Bạn đã có vé xem. Còn ${daysLeft} ngày đến giờ đua (${scheduleLine}).`,
        );
        if (created) notificationsCreated++;
        else skippedDuplicates++;
      }
    }
  }

  return {
    racesProcessed: races.length,
    notificationsCreated,
    skippedDuplicates,
  };
}
