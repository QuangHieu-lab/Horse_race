import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import { Prediction } from '../models/Prediction.model.js';
import { Product } from '../models/Product.model.js';
import { Race } from '../models/Race.model.js';
import { Redemption } from '../models/Redemption.model.js';
import { Result } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { User } from '../models/User.model.js';
import type {
  PredictionDto,
  ProductDto,
  RedemptionDto,
  SpectatorPointsDto,
  SpectatorRaceDto,
  TournamentDto,
} from '../types/api.types.js';
import type { RaceStatus } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';
import * as viewingTicketService from './viewing-ticket.service.js';
import { grantViewingPassFromVip } from './viewing-ticket.service.js';

function isPredictionWindowOpen(
  race: { predictionOpenAt?: Date | null; predictionCloseAt?: Date | null; status: RaceStatus },
  tournament: { predictionConfig: { isEnabled: boolean; predictionOpenAt?: Date | null; predictionCloseAt?: Date | null } },
): boolean {
  if (race.status !== 'scheduled') return false;
  if (!tournament.predictionConfig.isEnabled) return false;

  const now = new Date();
  const openAt = race.predictionOpenAt ?? tournament.predictionConfig.predictionOpenAt;
  const closeAt = race.predictionCloseAt ?? tournament.predictionConfig.predictionCloseAt;

  if (openAt && now < openAt) return false;
  if (closeAt && now > closeAt) return false;
  return true;
}

async function buildSpectatorRaceDto(
  race: {
    _id: mongoose.Types.ObjectId;
    name: string;
    round: number;
    scheduledAt: Date;
    status: RaceStatus;
    distance?: number;
    tournamentId: mongoose.Types.ObjectId;
    predictionOpenAt?: Date | null;
    predictionCloseAt?: Date | null;
    streamUrl?: string;
    viewingTicket?: {
      enabled: boolean;
      pricePoints: number;
      announceAt?: Date | null;
      saleOpensAt?: Date | null;
      saleExpiresAt?: Date | null;
      announcementMessage?: string;
      allowVipRedemption?: boolean;
    };
    participants: Array<{ horseId: mongoose.Types.ObjectId; laneNumber: number }>;
  },
  spectatorId?: mongoose.Types.ObjectId,
): Promise<SpectatorRaceDto> {
  const [tournament, horses, existingPrediction, result] = await Promise.all([
    Tournament.findById(race.tournamentId).lean(),
    Horse.find({
      _id: { $in: race.participants.map((p) => p.horseId) },
    })
      .select('name')
      .lean(),
    spectatorId
      ? Prediction.findOne({ raceId: race._id, spectatorId, status: { $ne: 'cancelled' } }).select('_id').lean()
      : null,
    Result.findOne({ raceId: race._id, publishedAt: { $ne: null } }).lean(),
  ]);

  if (!tournament) throw new HttpError(500, 'Không tìm thấy giải đấu');

  const horseMap = new Map(horses.map((h) => [h._id.toString(), h.name]));
  const activePredictions = await Prediction.find({
    raceId: race._id,
    status: { $ne: 'cancelled' },
  })
    .select('predictedRanks ticketCount riskMultiplier')
    .lean();
  const ticketCountByHorse = new Map<string, number>();
  for (const prediction of activePredictions) {
    const predictedWinner = prediction.predictedRanks.find((rank) => rank.rank === 1);
    if (!predictedWinner) continue;
    const horseId = predictedWinner.horseId.toString();
    const count = prediction.ticketCount ?? prediction.riskMultiplier ?? 1;
    ticketCountByHorse.set(horseId, (ticketCountByHorse.get(horseId) ?? 0) + count);
  }
  const canPredict =
    !!spectatorId &&
    isPredictionWindowOpen(race, tournament) &&
    race.participants.length > 0 &&
    !existingPrediction;

  let resultDto: SpectatorRaceDto['result'] = null;
  if (result) {
    const jockeyIds = result.rankings.map((r) => r.jockeyId);
    const resultHorseIds = [
      ...result.rankings.map((r) => r.horseId),
      ...result.violations.flatMap((v) => (v.horseId ? [v.horseId] : [])),
    ];
    const resultHorses = await Horse.find({
      _id: { $in: resultHorseIds },
    })
      .select('name')
      .lean();
    const jockeys = await User.find({ _id: { $in: jockeyIds } }).select('fullName').lean();
    const rHorseMap = new Map(resultHorses.map((h) => [h._id.toString(), h.name]));
    const jockeyMap = new Map(jockeys.map((j) => [j._id.toString(), j.fullName]));

    resultDto = {
      id: result._id.toString(),
      publishedAt: result.publishedAt?.toISOString() ?? null,
      rankings: result.rankings.map((r) => ({
        rank: r.rank,
        horse: {
          id: r.horseId.toString(),
          name: rHorseMap.get(r.horseId.toString()) ?? 'Unknown',
        },
        jockey: {
          id: r.jockeyId.toString(),
          fullName: jockeyMap.get(r.jockeyId.toString()) ?? 'Unknown',
        },
        finishTime: r.finishTime,
        prize: r.prize,
      })),
      violations: result.violations.map((v) => ({
        horseId: v.horseId?.toString() ?? null,
        horseName: v.horseId ? rHorseMap.get(v.horseId.toString()) ?? null : null,
        type: v.type,
        description: v.description,
        penaltyApplied: v.penaltyApplied ?? null,
      })),
    };
  }

  const openAt = race.predictionOpenAt ?? tournament.predictionConfig.predictionOpenAt;
  const closeAt = race.predictionCloseAt ?? tournament.predictionConfig.predictionCloseAt;

  const now = new Date();
  const spectatorIdStr = spectatorId?.toString();
  const hasPass = spectatorIdStr
    ? await viewingTicketService.findActivePass(spectatorIdStr, race._id)
    : false;
  const vt = race.viewingTicket;
  const raceLike = {
    _id: race._id,
    status: race.status,
    streamUrl: race.streamUrl,
    viewingTicket: {
      enabled: vt?.enabled ?? false,
      pricePoints: vt?.pricePoints ?? 0,
      announceAt: vt?.announceAt ?? null,
      saleOpensAt: vt?.saleOpensAt ?? null,
      saleExpiresAt: vt?.saleExpiresAt ?? null,
      announcementMessage: vt?.announcementMessage,
      allowVipRedemption: vt?.allowVipRedemption ?? false,
    },
    scheduledAt: race.scheduledAt,
    name: race.name,
    tournamentId: race.tournamentId,
  };
  const ticketState = viewingTicketService.getViewingTicketState(raceLike, now, hasPass);
  const hasAccess = spectatorIdStr
    ? await viewingTicketService.hasViewingAccess(spectatorIdStr, raceLike)
    : !ticketState.requiresTicket;
  const streamUrl = viewingTicketService.resolveStreamUrl(raceLike, hasAccess);

  return {
    id: race._id.toString(),
    name: race.name,
    round: race.round,
    scheduledAt: race.scheduledAt.toISOString(),
    status: race.status,
    distance: race.distance,
    tournament: { id: tournament._id.toString(), name: tournament.name },
    participants: race.participants.map((p) => ({
      id: p.horseId.toString(),
      name: horseMap.get(p.horseId.toString()) ?? 'Unknown',
      laneNumber: p.laneNumber,
      ticketCount: ticketCountByHorse.get(p.horseId.toString()) ?? 0,
    })),
    canPredict,
    hasPrediction: !!existingPrediction,
    predictionOpenAt: openAt?.toISOString() ?? null,
    predictionCloseAt: closeAt?.toISOString() ?? null,
    predictionConfig: {
      isEnabled: tournament.predictionConfig.isEnabled,
      poolEnabled: tournament.predictionConfig.poolEnabled,
      entryFee: tournament.predictionConfig.entryFee,
      ticketPrice: tournament.predictionConfig.entryFee,
      quickRiskMultipliers: tournament.predictionConfig.quickRiskMultipliers,
    },
    result: resultDto,
    viewingTicket: viewingTicketService.buildViewingTicketDto(ticketState),
    streamUrl,
  };
}

export async function listTournaments(): Promise<TournamentDto[]> {
  const tournaments = await Tournament.find({
    status: { $in: ['published', 'ongoing'] },
  })
    .sort({ startDate: -1 })
    .lean();

  return tournaments.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    description: t.description,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    location: t.location,
    status: t.status,
  }));
}

export async function listSpectatorRaces(
  spectatorId: string,
  filter?: 'open' | 'upcoming' | 'completed',
): Promise<SpectatorRaceDto[]> {
  const spectatorObjectId = new mongoose.Types.ObjectId(spectatorId);
  let races;

  if (filter === 'completed') {
    races = await Race.find({ status: { $in: ['completed', 'cancelled'] } })
      .sort({ scheduledAt: -1 })
      .lean();
  } else if (filter === 'upcoming') {
    races = await Race.find({ status: 'scheduled' })
      .sort({ scheduledAt: 1 })
      .lean();
  } else {
    races = await Race.find({
      status: { $in: ['scheduled', 'ongoing', 'completed'] },
    })
      .sort({ scheduledAt: -1 })
      .lean();
  }

  const dtos: SpectatorRaceDto[] = [];
  for (const race of races) {
    const dto = await buildSpectatorRaceDto(race, spectatorObjectId);
    if (filter === 'open' && !dto.canPredict && !dto.hasPrediction) continue;
    dtos.push(dto);
  }
  return dtos;
}

export async function getSpectatorRace(
  spectatorId: string,
  raceId: string,
): Promise<SpectatorRaceDto> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }
  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  return buildSpectatorRaceDto(race, new mongoose.Types.ObjectId(spectatorId));
}

export async function getOrCreateProfile(spectatorId: string): Promise<SpectatorPointsDto> {
  const userObjectId = new mongoose.Types.ObjectId(spectatorId);
  let profile = await SpectatorProfile.findOne({ userId: userObjectId });
  if (!profile) {
    profile = await SpectatorProfile.create({ userId: userObjectId });
  }

  return {
    currentBalance: profile.currentBalance,
    totalPointsEarned: profile.totalPointsEarned,
    totalPointsSpent: profile.totalPointsSpent,
    transactions: profile.transactions
      .slice()
      .reverse()
      .map((tx, idx) => ({
        id: `${profile!._id}-${idx}`,
        type: tx.type,
        points: tx.points,
        balanceAfter: tx.balanceAfter,
        note: tx.note,
        createdAt: tx.createdAt.toISOString(),
      })),
  };
}

export async function listProducts(): Promise<ProductDto[]> {
  const products = await Product.find({ isActive: true }).sort({ pointsCost: 1 }).lean();
  return products.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    description: p.description,
    category: p.category,
    pointsCost: p.pointsCost,
    stock: p.stock,
    isInStock: p.stock === -1 || p.stock > 0,
    linkedRaceId: p.linkedRaceId?.toString() ?? null,
    voucherKind: p.voucherKind ?? null,
  }));
}

export async function redeemProduct(
  spectatorId: string,
  productId: string,
  quantity: number,
): Promise<{ redemption: RedemptionDto; points: SpectatorPointsDto }> {
  if (!mongoose.isValidObjectId(productId)) {
    throw new HttpError(400, 'ID sản phẩm không hợp lệ');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpError(400, 'Số lượng phải là số nguyên dương');
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new HttpError(404, 'Không tìm thấy sản phẩm');
  }
  if (product.stock !== -1 && product.stock < quantity) {
    throw new HttpError(409, 'Sản phẩm không đủ tồn kho');
  }

  if (
    product.voucherKind === 'race_viewing_pass' &&
    product.linkedRaceId &&
    quantity > 1
  ) {
    throw new HttpError(400, 'Voucher vé xem chỉ được đổi từng vé một');
  }

  if (product.voucherKind === 'race_viewing_pass' && product.linkedRaceId) {
    const linkedRace = await Race.findById(product.linkedRaceId).lean();
    if (!linkedRace) throw new HttpError(404, 'Cuộc đua gắn voucher không tồn tại');
    if (!linkedRace.viewingTicket?.enabled) {
      throw new HttpError(409, 'Cuộc đua này không bán vé xem');
    }
    if (!linkedRace.viewingTicket.allowVipRedemption) {
      throw new HttpError(403, 'Cuộc đua này không hỗ trợ đổi voucher VIP');
    }
    const hasPass = await viewingTicketService.findActivePass(
      spectatorId,
      linkedRace._id,
    );
    if (hasPass) {
      throw new HttpError(409, 'Bạn đã có vé xem cuộc đua này');
    }
  }

  const totalPoints = product.pointsCost * quantity;
  const profile = await SpectatorProfile.findOne({
    userId: new mongoose.Types.ObjectId(spectatorId),
  });
  if (!profile || profile.currentBalance < totalPoints) {
    throw new HttpError(409, 'Không đủ điểm để đổi quà');
  }

  const redemption = await Redemption.create({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
    productId: product._id,
    pointsSpent: product.pointsCost,
    quantity,
    totalPoints,
    status: 'pending',
  });

  await profile.spendPoints(
    totalPoints,
    'spent_redemption',
    'Redemption',
    redemption._id,
    `Đổi ${product.name}`,
  );

  if (product.stock !== -1) {
    product.stock -= quantity;
    product.totalRedeemed += quantity;
    await product.save();
  } else {
    product.totalRedeemed += quantity;
    await product.save();
  }

  let viewingPass = undefined;
  if (product.voucherKind === 'race_viewing_pass' && product.linkedRaceId) {
    viewingPass = await grantViewingPassFromVip(
      spectatorId,
      product.linkedRaceId.toString(),
    );
  }

  return {
    redemption: {
      id: redemption._id.toString(),
      productName: product.name,
      quantity: redemption.quantity,
      totalPoints: redemption.totalPoints,
      status: redemption.status,
      createdAt: redemption.createdAt.toISOString(),
    },
    points: await getOrCreateProfile(spectatorId),
    ...(viewingPass ? { viewingPass } : {}),
  };
}

export async function listPredictions(spectatorId: string): Promise<PredictionDto[]> {
  const predictions = await Prediction.find({
    spectatorId: new mongoose.Types.ObjectId(spectatorId),
  })
    .sort({ createdAt: -1 })
    .lean();

  const raceIds = predictions.map((p) => p.raceId);
  const races = await Race.find({ _id: { $in: raceIds } }).select('name tournamentId').lean();
  const tournamentIds = races.map((r) => r.tournamentId);
  const tournaments = await Tournament.find({ _id: { $in: tournamentIds } }).select('name').lean();

  const raceMap = new Map(races.map((r) => [r._id.toString(), r]));
  const tournamentMap = new Map(tournaments.map((t) => [t._id.toString(), t.name]));

  const allHorseIds = predictions.flatMap((p) => p.predictedRanks.map((r) => r.horseId));
  const horses = await Horse.find({ _id: { $in: allHorseIds } }).select('name').lean();
  const horseMap = new Map(horses.map((h) => [h._id.toString(), h.name]));

  return predictions.map((p) => {
    const race = raceMap.get(p.raceId.toString());
    const tournamentName = race
      ? (tournamentMap.get(race.tournamentId.toString()) ?? 'Unknown')
      : 'Unknown';
    return {
      id: p._id.toString(),
      raceId: p.raceId.toString(),
      raceName: race?.name ?? 'Unknown',
      tournamentName,
      predictedRanks: p.predictedRanks.map((r) => ({
        rank: r.rank,
        horseId: r.horseId.toString(),
        horseName: horseMap.get(r.horseId.toString()),
      })),
      status: p.status,
      ticketCount: p.ticketCount ?? p.riskMultiplier ?? 1,
      riskMultiplier: p.riskMultiplier,
      contribution: p.contribution,
      predictionScore: p.scoringWeight,
      pointsEarned: p.pointsEarned,
      bonusPoints: p.bonusPoints,
      poolShare: p.poolShare,
      totalPoints: p.totalPoints,
      evaluatedAt: p.evaluatedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

export async function getRaceSimulation(raceId: string) {
  if (!mongoose.isValidObjectId(raceId)) throw new HttpError(400, 'ID không hợp lệ');
  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.status !== 'completed') return { available: false as const, rankings: [] };
  const result = await Result.findOne({ raceId: race._id, publishedAt: { $ne: null } }).lean();
  if (!result) return { available: false as const, rankings: [] };
  return {
    available: true as const,
    rankings: result.rankings.map(r => ({
      horseId: r.horseId.toString(),
      rank: r.rank,
      finishTime: r.finishTime,
    })),
  };
}

export { buildSpectatorRaceDto, isPredictionWindowOpen };
