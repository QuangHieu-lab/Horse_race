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

function pct(amount: number, rate: number): number {
  return Math.floor((amount * rate) / 100);
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

export async function getOrCreatePredictionPool(race: {
  _id: mongoose.Types.ObjectId;
  tournamentId: mongoose.Types.ObjectId;
  ticketPrice?: number;
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
): Promise<{ contribution: number; poolId: mongoose.Types.ObjectId; riskMultiplier: number }> {
  const pool = await getOrCreatePredictionPool(race);
  if (pool.status !== 'open') {
    throw new HttpError(409, 'Bounty pool đã đóng');
  }
  const riskMultiplier = race.riskMultiplier ?? 1;
  if (!Number.isInteger(riskMultiplier)) {
    throw new HttpError(400, 'Mức rủi ro phải là số nguyên');
  }
  if (riskMultiplier < pool.minRiskMultiplier || riskMultiplier > pool.maxRiskMultiplier) {
    throw new HttpError(
      400,
      `Mức rủi ro phải nằm trong khoảng ${pool.minRiskMultiplier}x đến ${pool.maxRiskMultiplier}x`,
    );
  }
  if (pool.ticketPrice < MIN_ENTRY_POINTS) {
    throw new HttpError(400, `Entry points tối thiểu là ${MIN_ENTRY_POINTS}`);
  }
  const contribution = pool.ticketPrice * riskMultiplier;

  const spectatorObjectId = new mongoose.Types.ObjectId(spectatorId);
  const profile = await getOrCreateProfile(spectatorObjectId);
  try {
    await profile.spendPoints(
      contribution,
      'spent_pool_entry',
      'PredictionPool',
      pool._id,
      `Tham gia dự đoán ${riskMultiplier}x cuộc đua ${race.name}`,
    );
  } catch {
    throw new HttpError(409, 'Không đủ điểm để tham gia dự đoán');
  }

  pool.totalTickets += 1;
  pool.contributorCount += 1;
  pool.totalBountyPool += contribution;
  await pool.save();

  return { contribution, poolId: pool._id, riskMultiplier };
}

export async function settlePredictionPoolFromResult(
  result: Pick<IResult, 'raceId' | 'rankings' | 'tournamentId' | 'publishedBy'>,
): Promise<void> {
  const race = await Race.findById(result.raceId).lean();
  if (!race) return;
  const tournament = await Tournament.findById(result.tournamentId).lean();

  const pool = await PredictionPool.findOne({ raceId: result.raceId });
  if (!pool || pool.status === 'settled') return;

  const predictions = await Prediction.find({ raceId: result.raceId });
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
  const winners = predictions.filter((prediction) =>
    isWinningPrediction(prediction.predictedRanks, actualRankings),
  );
  const losers = predictions.filter(
    (prediction) => !isWinningPrediction(prediction.predictedRanks, actualRankings),
  );
  const totalBountyPool = predictions.reduce((sum, p) => sum + p.contribution, 0);
  const winPool = losers.reduce((sum, p) => sum + p.contribution, 0);
  const totalWinningContribution = winners.reduce((sum, p) => sum + p.contribution, 0);
  pool.totalTickets = predictions.length;
  pool.contributorCount = predictions.length;
  pool.totalBountyPool = totalBountyPool;
  pool.winPool = winPool;
  pool.organizerFee = pct(winPool, pool.organizerFeeRate);
  pool.racingRewardPool = pct(winPool, pool.racingRewardRate);
  pool.spectatorRewardPool = winPool - pool.organizerFee - pool.racingRewardPool;
  pool.ownerReward = 0;
  pool.jockeyReward = 0;
  pool.racingRewards = [];
  pool.totalWinnerScore = totalWinningContribution;

  if (totalWinningContribution === 0) {
    pool.jackpotAmount = pool.spectatorRewardPool;
    pool.spectatorRewardPool = 0;
  }

  for (const prediction of predictions) {
    const isWinner = winners.some((winner) => winner._id.equals(prediction._id));
    const prizeShare =
      isWinner && totalWinningContribution > 0
        ? Math.floor((prediction.contribution / totalWinningContribution) * pool.spectatorRewardPool)
        : 0;
    const refund = isWinner ? prediction.contribution : 0;
    const totalReturned = refund + prizeShare;

    prediction.scoringWeight = isWinner ? 1 : 0;
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
        `Hoàn điểm dự đoán đúng và chia thưởng bounty pool cuộc đua ${race.name}`,
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

  const winningRankings = result.rankings.filter((ranking) => ranking.rank === 1);
  if (winningRankings.length > 0) {
    const horseReward = Math.floor(pool.racingRewardPool / winningRankings.length);
    const isDeadHeat = winningRankings.length > 1 || winningRankings.some((r) => r.isDeadHeat);

    for (const ranking of winningRankings) {
      const rank = 1;
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

      await Notification.create([
        {
          userId: ranking.ownerId,
          type: 'prediction_reward',
          title: 'Thưởng owner từ bounty pool',
          message: `Owner nhận ${ownerReward} điểm thưởng ngựa về nhất từ bounty pool cuộc đua ${race.name}.`,
          refModel: 'PredictionPool',
          refId: pool._id,
        },
        {
          userId: ranking.jockeyId,
          type: 'prediction_reward',
          title: 'Thưởng jockey từ bounty pool',
          message: `Jockey nhận ${jockeyReward} điểm thưởng ngựa về nhất từ bounty pool cuộc đua ${race.name}.`,
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
