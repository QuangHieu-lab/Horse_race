import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { OrganizerLedger } from '../models/OrganizerLedger.model.js';
import { Race, type IRace } from '../models/Race.model.js';
import { RaceViewingPass } from '../models/RaceViewingPass.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import type {
  RaceViewingPassDto,
  ViewingTicketInfoDto,
} from '../types/api.types.js';
import type { ViewingPassSource } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';
import { isTicketRequired } from '../utils/viewing-ticket.js';

type RaceLike = Pick<IRace, 'status' | 'streamUrl' | 'viewingTicket' | 'scheduledAt' | 'name' | 'tournamentId'> & {
  _id: mongoose.Types.ObjectId;
};

export interface ViewingTicketState {
  requiresTicket: boolean;
  hasPass: boolean;
  canPurchase: boolean;
  pricePoints: number;
  announceAt: string | null;
  saleOpensAt: string | null;
  saleExpiresAt: string | null;
  announcementMessage?: string;
  allowVipRedemption: boolean;
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function getViewingTicketState(
  race: RaceLike,
  now: Date,
  hasPass: boolean,
): ViewingTicketState {
  const vt = race.viewingTicket ?? { enabled: false, pricePoints: 0, allowVipRedemption: false };
  const requiresTicket = isTicketRequired(vt);
  const announceAt = vt.announceAt ?? null;
  const saleOpensAt = vt.saleOpensAt ?? announceAt;
  const saleExpiresAt = vt.saleExpiresAt ?? null;

  let canPurchase = false;
  if (requiresTicket && !hasPass && race.status === 'scheduled') {
    const opensOk = !saleOpensAt || now >= saleOpensAt;
    const notExpired = !saleExpiresAt || now < saleExpiresAt;
    canPurchase = opensOk && notExpired;
  }

  return {
    requiresTicket,
    hasPass,
    canPurchase,
    pricePoints: vt.pricePoints,
    announceAt: toIso(announceAt),
    saleOpensAt: toIso(saleOpensAt),
    saleExpiresAt: toIso(saleExpiresAt),
    announcementMessage: vt.announcementMessage,
    allowVipRedemption: vt.allowVipRedemption ?? false,
  };
}

export function buildViewingTicketDto(state: ViewingTicketState): ViewingTicketInfoDto {
  return { ...state };
}

export async function findActivePass(
  spectatorId: string,
  raceId: mongoose.Types.ObjectId,
): Promise<boolean> {
  const pass = await RaceViewingPass.findOne({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    raceId,
    status: 'active',
  }).lean();
  return !!pass;
}

export async function hasViewingAccess(
  spectatorId: string,
  race: RaceLike,
): Promise<boolean> {
  if (race.status === 'cancelled') return false;
  const vt = race.viewingTicket;
  if (!isTicketRequired(vt)) return true;
  return findActivePass(spectatorId, race._id);
}

async function ensureSpectatorProfile(spectatorId: string) {
  let profile = await SpectatorProfile.findOne({
    userId: new mongoose.Types.ObjectId(spectatorId),
  });
  if (!profile) {
    profile = await SpectatorProfile.create({
      userId: new mongoose.Types.ObjectId(spectatorId),
    });
  }
  return profile;
}

function toPassDto(
  pass: {
    _id: mongoose.Types.ObjectId;
    raceId: mongoose.Types.ObjectId;
    source: ViewingPassSource;
    pointsPaid: number;
    purchasedAt: Date;
    status: string;
  },
  race?: { name: string; scheduledAt: Date },
): RaceViewingPassDto {
  return {
    id: pass._id.toString(),
    raceId: pass.raceId.toString(),
    raceName: race?.name,
    scheduledAt: race?.scheduledAt.toISOString(),
    source: pass.source,
    pointsPaid: pass.pointsPaid,
    purchasedAt: pass.purchasedAt.toISOString(),
    status: pass.status as RaceViewingPassDto['status'],
  };
}

async function createPassRecord(
  spectatorId: string,
  race: RaceLike,
  source: ViewingPassSource,
  pointsPaid: number,
): Promise<typeof RaceViewingPass.prototype> {
  const existing = await RaceViewingPass.findOne({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    raceId: race._id,
  });
  if (existing) {
    if (existing.status === 'active') {
      throw new HttpError(409, 'Bạn đã có vé xem cuộc đua này');
    }
    throw new HttpError(409, 'Vé xem không còn hợp lệ');
  }

  return RaceViewingPass.create({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    raceId: race._id,
    source,
    pointsPaid,
    purchasedAt: new Date(),
    status: 'active',
  });
}

export async function grantViewingPassFromVip(
  spectatorId: string,
  raceId: string,
): Promise<RaceViewingPassDto> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  if (!race.viewingTicket?.enabled) {
    throw new HttpError(409, 'Cuộc đua này không bán vé xem');
  }
  if (!race.viewingTicket.allowVipRedemption) {
    throw new HttpError(403, 'Cuộc đua này không hỗ trợ đổi voucher VIP');
  }

  const pass = await createPassRecord(spectatorId, race as RaceLike, 'vip_redemption', 0);

  await Notification.create({
    userId: new mongoose.Types.ObjectId(spectatorId),
    type: 'viewing_ticket_purchased',
    title: 'Vé xem VIP đã kích hoạt',
    message: `Bạn đã nhận vé xem "${race.name}" qua voucher VIP.`,
    refModel: 'RaceViewingPass',
    refId: pass._id,
  });

  return toPassDto(pass, { name: race.name, scheduledAt: race.scheduledAt });
}

export async function purchaseViewingPass(
  spectatorId: string,
  raceId: string,
): Promise<{ pass: RaceViewingPassDto; viewingTicket: ViewingTicketInfoDto }> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const vt = race.viewingTicket;
  if (!isTicketRequired(vt)) {
    throw new HttpError(409, 'Cuộc đua này không yêu cầu mua vé');
  }

  const now = new Date();
  const hasPass = await findActivePass(spectatorId, race._id);
  const state = getViewingTicketState(race as RaceLike, now, hasPass);

  if (hasPass) {
    throw new HttpError(409, 'Bạn đã có vé xem cuộc đua này');
  }
  if (!state.canPurchase) {
    if (state.saleOpensAt && now < new Date(state.saleOpensAt)) {
      throw new HttpError(403, 'Vé chưa mở bán');
    }
    throw new HttpError(409, 'Đã hết thời gian mua vé');
  }

  const profile = await ensureSpectatorProfile(spectatorId);
  if (profile.currentBalance < vt.pricePoints) {
    throw new HttpError(409, 'Không đủ điểm để mua vé');
  }

  const pass = await createPassRecord(spectatorId, race as RaceLike, 'purchase', vt.pricePoints);

  await profile.spendPoints(
    vt.pricePoints,
    'spent_viewing_ticket',
    'RaceViewingPass',
    pass._id,
    `Mua vé xem ${race.name}`,
  );

  await Notification.create({
    userId: new mongoose.Types.ObjectId(spectatorId),
    type: 'viewing_ticket_purchased',
    title: 'Mua vé thành công',
    message: `Bạn đã mua vé xem "${race.name}" với ${vt.pricePoints} điểm.`,
    refModel: 'RaceViewingPass',
    refId: pass._id,
  });

  await OrganizerLedger.create({
    tournamentId: race.tournamentId,
    raceId: race._id,
    feeAmount: vt.pricePoints,
    note: `Vé xem cuộc đua: ${race.name}`,
    recordedBy: new mongoose.Types.ObjectId(spectatorId),
  });

  const updatedState = getViewingTicketState(race as RaceLike, now, true);
  return {
    pass: toPassDto(pass, { name: race.name, scheduledAt: race.scheduledAt }),
    viewingTicket: buildViewingTicketDto(updatedState),
  };
}

export async function listViewingPasses(
  spectatorId: string,
  filter?: 'upcoming',
): Promise<RaceViewingPassDto[]> {
  const passes = await RaceViewingPass.find({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    status: 'active',
  })
    .sort({ purchasedAt: -1 })
    .lean();

  const raceIds = passes.map((p) => p.raceId);
  const races = await Race.find({ _id: { $in: raceIds } })
    .select('name scheduledAt status')
    .lean();
  const raceMap = new Map(races.map((r) => [r._id.toString(), r]));

  const now = new Date();
  const dtos: RaceViewingPassDto[] = [];

  for (const pass of passes) {
    const race = raceMap.get(pass.raceId.toString());
    if (!race) continue;
    if (filter === 'upcoming' && (race.status === 'completed' || race.status === 'cancelled')) {
      continue;
    }
    if (filter === 'upcoming' && race.scheduledAt < now && race.status === 'scheduled') {
      continue;
    }
    dtos.push(
      toPassDto(pass, { name: race.name, scheduledAt: race.scheduledAt }),
    );
  }

  return dtos;
}

export function resolveStreamUrl(
  race: RaceLike,
  hasAccess: boolean,
): string | undefined {
  if (!hasAccess || !race.streamUrl) return undefined;
  return race.streamUrl;
}
