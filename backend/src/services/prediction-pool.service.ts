import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { OrganizerLedger } from '../models/OrganizerLedger.model.js';
import { Prediction } from '../models/Prediction.model.js';
import { PredictionPool } from '../models/PredictionPool.model.js';
import { Race } from '../models/Race.model.js';
import type { IResult } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { HttpError } from '../utils/http-error.js';

const MIN_ENTRY_POINTS = 100;
const DEFAULT_TICKET_PRICE = MIN_ENTRY_POINTS;
const ORGANIZER_FEE_RATE = 10;
const RACING_REWARD_RATE = 15;
const SPECTATOR_REWARD_RATE = 75;
const OWNER_SHARE_RATE = 80;
const JOCKEY_SHARE_RATE = 20;
const RANK_REWARD_RATE_PRESETS: Record<number, number[]> = {
  5: [50, 25, 15, 7, 3],
  6: [45, 23, 15, 8, 6, 3],
  7: [40, 22, 15, 10, 6, 4, 3],
  8: [36, 21, 15, 10, 7, 5, 4, 2],
  9: [33, 20, 15, 10, 7, 5, 4, 3, 3],
  10: [30, 19, 14, 10, 8, 6, 5, 3, 3, 2],
  11: [28, 18, 14, 10, 8, 6, 5, 4, 3, 2, 2],
  12: [26, 17, 14, 10, 8, 6, 5, 4, 3, 3, 2, 2],
  13: [25, 16, 13, 10, 8, 6, 5, 4, 3, 3, 3, 2, 2],
};

function pct(amount: number, rate: number): number {
  return Math.floor((amount * rate) / 100);
}

/**
 * Điểm dự đoán dùng để chia PrizePool giữa những người đoán đúng.
 * Mỗi phiếu có cùng trọng số, nên score chia thưởng là số phiếu.
 */
function predictionScoreOf(p: { ticketCount?: number; riskMultiplier?: number; contribution: number }): number {
  return p.ticketCount ?? p.riskMultiplier ?? p.contribution;
}

function sumRates(rates: number[]): number {
  return rates.reduce((sum, rate) => sum + rate, 0);
}

function resolveRankRewardRates(participantCount: number, configuredRates?: number[]): number[] {
  if (
    configuredRates?.length === participantCount &&
    Math.abs(sumRates(configuredRates) - 100) < 0.0001
  ) {
    return configuredRates;
  }

  const cappedCount = Math.min(13, Math.max(5, participantCount));
  const preset = RANK_REWARD_RATE_PRESETS[cappedCount] ?? RANK_REWARD_RATE_PRESETS[5]!;
  if (participantCount <= 13) return preset.slice(0, participantCount);
  return [...preset, ...Array(participantCount - 13).fill(0)];
}

function isWinningPrediction(
  predictedRanks: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
  actualRankings: Array<{ rank: number; horseId: mongoose.Types.ObjectId }>,
): boolean {
  const predictedWinner = predictedRanks.find((p) => p.rank === 1);
  if (!predictedWinner) return false;
  return actualRankings.some(
    (ranking) => ranking.rank === 1 && ranking.horseId.toString() === predictedWinner.horseId.toString(),
  );
}

async function getOrCreateProfile(userId: mongoose.Types.ObjectId) {
  let profile = await SpectatorProfile.findOne({ userId });
  if (!profile) profile = await SpectatorProfile.create({ userId });
  return profile;
}

async function awardPoolPoints(
  userId: mongoose.Types.ObjectId,
  points: number,
  note: string,
  poolId: mongoose.Types.ObjectId,
): Promise<void> {
  if (points <= 0) return;
  const profile = await getOrCreateProfile(userId);
  await profile.addPoints(points, 'earned_pool_share', 'PredictionPool', poolId, note);
}

function disqualifiedHorseIdsFromRace(race: {
  participants: Array<{ horseId: mongoose.Types.ObjectId; isDisqualified?: boolean }>;
}): Set<string> {
  return new Set(
    race.participants
      .filter((participant) => participant.isDisqualified)
      .map((participant) => participant.horseId.toString()),
  );
}

export async function getOrCreatePredictionPool(race: {
  _id: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  ticketPrice?: number;
  ticketCount?: number;
  minRiskMultiplier?: number;
  maxRiskMultiplier?: number;
  quickRiskMultipliers?: number[];
  organizerFeeRate?: number;
  racingRewardRate?: number;
  spectatorRewardRate?: number;
  ownerShareRate?: number;
  jockeyShareRate?: number;
}) {
  const pool = await PredictionPool.findOneAndUpdate(
    { raceId: race._id },
    {
      $setOnInsert: {
        raceId: race._id,
        tournamentId: race.tournamentId,
        status: 'open',
        ticketPrice: race.ticketPrice ?? DEFAULT_TICKET_PRICE,
        minRiskMultiplier: race.minRiskMultiplier ?? 1,
        maxRiskMultiplier: race.maxRiskMultiplier ?? 10,
        quickRiskMultipliers: race.quickRiskMultipliers ?? [1, 2, 3, 6],
        organizerFeeRate: race.organizerFeeRate ?? ORGANIZER_FEE_RATE,
        racingRewardRate: race.racingRewardRate ?? RACING_REWARD_RATE,
        spectatorRewardRate: race.spectatorRewardRate ?? SPECTATOR_REWARD_RATE,
        ownerShareRate: race.ownerShareRate ?? OWNER_SHARE_RATE,
        jockeyShareRate: race.jockeyShareRate ?? JOCKEY_SHARE_RATE,
      },
    },
    { new: true, upsert: true },
  );

  return pool;
}

export async function chargePredictionTicket(
  spectatorId: string,
  race: {
    _id: mongoose.Types.ObjectId;
    tournamentId: mongoose.Types.ObjectId;
    name: string;
    ticketPrice?: number;
    ticketCount?: number;
    riskMultiplier?: number;
    minRiskMultiplier?: number;
    maxRiskMultiplier?: number;
    quickRiskMultipliers?: number[];
    organizerFeeRate?: number;
    racingRewardRate?: number;
    spectatorRewardRate?: number;
    ownerShareRate?: number;
    jockeyShareRate?: number;
  },
): Promise<{ contribution: number; poolId: mongoose.Types.ObjectId; ticketCount: number }> {
  const pool = await getOrCreatePredictionPool(race);
  if (pool.status !== 'open') {
    throw new HttpError(409, 'Bounty pool đã đóng');
  }
  const ticketCount = race.ticketCount ?? race.riskMultiplier ?? 1;
  if (!Number.isInteger(ticketCount) || ticketCount < 1) {
    throw new HttpError(400, 'Số phiếu phải là số nguyên dương');
  }
  if (pool.ticketPrice < MIN_ENTRY_POINTS) {
    throw new HttpError(400, `Giá 1 phiếu tối thiểu là ${MIN_ENTRY_POINTS} điểm`);
  }
  const contribution = pool.ticketPrice * ticketCount;

  const spectatorObjectId = new mongoose.Types.ObjectId(spectatorId);
  const profile = await getOrCreateProfile(spectatorObjectId);
  try {
    await profile.spendPoints(
      contribution,
      'spent_pool_entry',
      'PredictionPool',
      pool._id,
      `Mua ${ticketCount} phiếu dự đoán cuộc đua ${race.name}`,
    );
  } catch {
    throw new HttpError(409, 'Không đủ điểm để tham gia dự đoán');
  }

  pool.totalTickets += ticketCount;
  pool.contributorCount += 1;
  pool.totalBountyPool += contribution;
  await pool.save();

  return { contribution, poolId: pool._id, ticketCount };
}

export async function refundPredictionTicket(
  spectatorId: string,
  predictionId: mongoose.Types.ObjectId,
  raceId: mongoose.Types.ObjectId,
  contribution: number,
  raceName: string,
): Promise<void> {
  if (contribution <= 0) return;

  const pool = await PredictionPool.findOne({ raceId });
  if (!pool) {
    throw new HttpError(404, 'Không tìm thấy bounty pool');
  }
  if (pool.status !== 'open') {
    throw new HttpError(409, 'Bounty pool đã đóng, không thể hủy dự đoán');
  }

  const spectatorObjectId = new mongoose.Types.ObjectId(spectatorId);
  const profile = await getOrCreateProfile(spectatorObjectId);
  await profile.addPoints(
    contribution,
    'refunded_pool',
    'Prediction',
    predictionId,
    `Hoàn điểm hủy dự đoán cuộc đua ${raceName}`,
  );

  const refundedTicketCount = pool.ticketPrice > 0 ? Math.floor(contribution / pool.ticketPrice) : 1;
  pool.totalTickets = Math.max(0, pool.totalTickets - Math.max(1, refundedTicketCount));
  pool.contributorCount = Math.max(0, pool.contributorCount - 1);
  pool.totalBountyPool = Math.max(0, pool.totalBountyPool - contribution);
  await pool.save();
}

export async function settlePredictionPoolFromResult(
  result: Pick<IResult, 'raceId' | 'rankings' | 'tournamentId' | 'publishedBy'>,
): Promise<void> {
  const race = await Race.findById(result.raceId).lean();
  if (!race) return;
  const tournament = await Tournament.findById(result.tournamentId).lean();

  const pool = await PredictionPool.findOne({ raceId: result.raceId });
  if (!pool || pool.status === 'settled') return;

  const predictions = await Prediction.find({ raceId: result.raceId, status: { $ne: 'cancelled' } });
  if (predictions.length === 0) {
    pool.status = 'settled';
    pool.settledAt = new Date();
    await pool.save();
    return;
  }

  const actualRankings = result.rankings.map((r) => ({
    rank: r.rank,
    horseId: r.horseId,
  }));
  const disqualifiedHorseIds = disqualifiedHorseIdsFromRace(race);
  const eligibleActualRankings = actualRankings.filter(
    (ranking) => !disqualifiedHorseIds.has(ranking.horseId.toString()),
  );
  const winners = predictions.filter((prediction) =>
    isWinningPrediction(prediction.predictedRanks, eligibleActualRankings),
  );
  const losers = predictions.filter(
    (prediction) => !isWinningPrediction(prediction.predictedRanks, eligibleActualRankings),
  );
  const totalBountyPool = predictions.reduce((sum, p) => sum + p.contribution, 0);
  const winPool = losers.reduce((sum, p) => sum + p.contribution, 0);
  const minScoreToShare = tournament?.predictionConfig.minScoreToShare ?? 1;
  const qualifiedWinners = winners.filter((prediction) => predictionScoreOf(prediction) >= minScoreToShare);
  // Tổng số phiếu của những người đoán đúng — dùng để chia PrizePool.
  const totalWinnerScore = qualifiedWinners.reduce((sum, p) => sum + predictionScoreOf(p), 0);
  pool.totalTickets = predictions.reduce((sum, p) => sum + predictionScoreOf(p), 0);
  pool.contributorCount = predictions.length;
  pool.totalBountyPool = totalBountyPool;
  pool.winPool = winPool;
  pool.organizerFee = pct(winPool, pool.organizerFeeRate);
  pool.racingRewardPool = pct(winPool, pool.racingRewardRate);
  pool.spectatorRewardPool = winPool - pool.organizerFee - pool.racingRewardPool;
  pool.ownerReward = 0;
  pool.jockeyReward = 0;
  pool.racingRewards = [];
  pool.totalWinnerScore = totalWinnerScore;

  if (totalWinnerScore === 0) {
    // Không ai đủ điều kiện nhận PrizePool. Chính sách xử lý phần dư nằm ở rolloverPolicy.
    pool.jackpotAmount = pool.spectatorRewardPool;
    if (tournament?.predictionConfig.rolloverPolicy === 'refund') {
      pool.jackpotAmount = 0;
    } else if (tournament?.predictionConfig.rolloverPolicy === 'to_organizer') {
      pool.organizerFee += pool.spectatorRewardPool;
      pool.jackpotAmount = 0;
      pool.spectatorRewardPool = 0;
    } else {
      pool.spectatorRewardPool = 0;
    }
  }

  // Chia PrizePool theo tỷ lệ predictionScore. Phần dư do làm tròn (floor) được
  // dồn cho người có điểm cao nhất để không thất thoát điểm.
  const prizeShareByPrediction = new Map<string, number>();
  if (totalWinnerScore > 0 && pool.spectatorRewardPool > 0) {
    let distributed = 0;
    let topWinnerId: string | null = null;
    let topScore = -1;
    for (const winner of qualifiedWinners) {
      const score = predictionScoreOf(winner);
      const share = Math.floor((score / totalWinnerScore) * pool.spectatorRewardPool);
      prizeShareByPrediction.set(winner._id.toString(), share);
      distributed += share;
      if (score > topScore) {
        topScore = score;
        topWinnerId = winner._id.toString();
      }
    }
    const remainder = pool.spectatorRewardPool - distributed;
    if (remainder > 0 && topWinnerId) {
      prizeShareByPrediction.set(topWinnerId, (prizeShareByPrediction.get(topWinnerId) ?? 0) + remainder);
    }
  }

  for (const prediction of predictions) {
    const isWinner = winners.some((winner) => winner._id.equals(prediction._id));
    const isQualifiedWinner = qualifiedWinners.some((winner) => winner._id.equals(prediction._id));
    const score = isWinner ? predictionScoreOf(prediction) : 0;
    const prizeShare = prizeShareByPrediction.get(prediction._id.toString()) ?? 0;
    const noWinnerRefund =
      totalWinnerScore === 0 && tournament?.predictionConfig.rolloverPolicy === 'refund'
        ? prediction.contribution
        : 0;
    const refund = isWinner || isQualifiedWinner ? prediction.contribution : noWinnerRefund;
    const totalReturned = refund + prizeShare;

    prediction.scoringWeight = score; // DTO hiển thị là predictionScore
    prediction.pointsEarned = refund;
    prediction.bonusPoints = 0;
    prediction.poolShare = prizeShare;
    prediction.totalPoints = totalReturned;
    await prediction.save();

    if (totalReturned > 0) {
      const profile = await getOrCreateProfile(prediction.spectatorId);
      await profile.addPoints(
        totalReturned,
        'earned_pool_share',
        'PredictionPool',
        pool._id,
        noWinnerRefund > 0
          ? `Hoàn điểm do bounty pool cuộc đua ${race.name} không có người thắng`
          : `Hoàn điểm dự đoán đúng và chia thưởng bounty pool cuộc đua ${race.name}`,
      );

      await Notification.create({
        userId: prediction.spectatorId,
        type: 'prediction_reward',
        title: 'Thưởng bounty pool',
        message: `Bạn nhận ${totalReturned} điểm từ dự đoán đúng cuộc đua ${race.name}.`,
        refModel: 'PredictionPool',
        refId: pool._id,
      });
    }
  }

  const rankedGroups = new Map<number, typeof result.rankings>();
  for (const ranking of result.rankings) {
    if (disqualifiedHorseIds.has(ranking.horseId.toString())) continue;
    if (!rankedGroups.has(ranking.rank)) rankedGroups.set(ranking.rank, []);
    rankedGroups.get(ranking.rank)!.push(ranking);
  }
  const rankRewardRates = resolveRankRewardRates(
    result.rankings.length,
    tournament?.predictionConfig.rankRewardRates,
  );

  for (const [rank, rankings] of [...rankedGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const rankRate = rankRewardRates[rank - 1] ?? 0;
    if (rankRate <= 0 || rankings.length === 0) continue;
    const rankReward = pct(pool.racingRewardPool, rankRate);
    const horseReward = Math.floor(rankReward / rankings.length);
    const isDeadHeat = rankings.length > 1 || rankings.some((r) => r.isDeadHeat);

    for (const ranking of rankings) {
      const ownerReward = pct(horseReward, pool.ownerShareRate);
      const jockeyReward = horseReward - ownerReward;
      pool.ownerReward += ownerReward;
      pool.jockeyReward += jockeyReward;
      pool.racingRewards.push({
        rank,
        horseId: ranking.horseId,
        ownerId: ranking.ownerId,
        jockeyId: ranking.jockeyId,
        horseReward,
        ownerReward,
        jockeyReward,
        isDeadHeat,
      });

      await awardPoolPoints(
        ranking.ownerId,
        ownerReward,
        `Thưởng owner hạng ${rank} từ bounty pool cuộc đua ${race.name}`,
        pool._id,
      );
      await awardPoolPoints(
        ranking.jockeyId,
        jockeyReward,
        `Thưởng jockey hạng ${rank} từ bounty pool cuộc đua ${race.name}`,
        pool._id,
      );

      await Notification.create([
        {
          userId: ranking.ownerId,
          type: 'prediction_reward',
          title: 'Thưởng owner từ bounty pool',
          message: `Owner nhận ${ownerReward} điểm thưởng hạng ${rank} từ bounty pool cuộc đua ${race.name}.`,
          refModel: 'PredictionPool',
          refId: pool._id,
        },
        {
          userId: ranking.jockeyId,
          type: 'prediction_reward',
          title: 'Thưởng jockey từ bounty pool',
          message: `Jockey nhận ${jockeyReward} điểm thưởng hạng ${rank} từ bounty pool cuộc đua ${race.name}.`,
          refModel: 'PredictionPool',
          refId: pool._id,
        },
      ]);
    }
  }

  if (pool.organizerFee > 0) {
    await OrganizerLedger.create({
      tournamentId: result.tournamentId,
      raceId: result.raceId,
      predictionPoolId: pool._id,
      feeAmount: pool.organizerFee,
      note: `Organizer fee 10% từ bounty pool cuộc đua ${race.name}`,
      recordedBy: result.publishedBy ?? predictions[0]!.spectatorId,
    });
  }

  pool.status = 'settled';
  pool.settledAt = new Date();
  await pool.save();
}
