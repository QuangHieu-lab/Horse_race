import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Race } from '../models/Race.model.js';
import type { IResult } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { Tournament } from '../models/Tournament.model.js';
import type { PointsTxType } from '../types/shared.types.js';

const DEFAULT_OWNER_SHARE_RATE = 80;
const DEFAULT_FIXED_PRIZE_TOP_COUNT = 5;
const DEFAULT_FIXED_PRIZE_RATES = [50, 25, 12, 8, 5];

function pct(amount: number, rate: number): number {
  return Math.floor((amount * rate) / 100);
}

async function getOrCreateProfile(userId: mongoose.Types.ObjectId) {
  let profile = await SpectatorProfile.findOne({ userId });
  if (!profile) profile = await SpectatorProfile.create({ userId });
  return profile;
}

async function awardRacePrizePoints(
  userId: mongoose.Types.ObjectId,
  points: number,
  type: PointsTxType,
  resultId: mongoose.Types.ObjectId,
  note: string,
): Promise<boolean> {
  if (points <= 0) return false;
  const profile = await getOrCreateProfile(userId);
  const alreadyAwarded = profile.transactions.some(
    (tx) =>
      tx.type === type &&
      tx.refModel === 'Result' &&
      tx.refId?.equals(resultId) &&
      tx.note === note,
  );
  if (alreadyAwarded) return false;

  await profile.addPoints(points, type, 'Result', resultId, note);
  return true;
}

function disqualifiedHorseIdsFromRace(race: {
  participants: Array<{
    horseId: mongoose.Types.ObjectId;
    isDisqualified?: boolean;
    scratchedAt?: Date | null;
  }>;
}): Set<string> {
  return new Set(
    race.participants
      .filter((participant) => participant.isDisqualified)
      .map((participant) => participant.horseId.toString()),
  );
}

function resolveFixedPrizeRates(config?: {
  fixedPrizeTopCount?: number;
  fixedPrizeRankRates?: number[];
}): number[] {
  const topCount = config?.fixedPrizeTopCount === 4 ? 4 : DEFAULT_FIXED_PRIZE_TOP_COUNT;
  const configuredRates = config?.fixedPrizeRankRates;
  if (
    configuredRates?.length === topCount &&
    configuredRates.reduce((sum, rate) => sum + rate, 0) === 100
  ) {
    return configuredRates;
  }

  return topCount === 4 ? [55, 25, 12, 8] : DEFAULT_FIXED_PRIZE_RATES;
}

function assignFixedPrizes(
  result: Pick<IResult, 'rankings'>,
  prizePool: number,
  rates: number[],
  disqualifiedHorseIds: Set<string>,
): void {
  for (const ranking of result.rankings) {
    ranking.prize = 0;
  }
  if (prizePool <= 0) return;

  const eligibleGroups = new Map<number, typeof result.rankings>();
  for (const ranking of result.rankings) {
    if (disqualifiedHorseIds.has(ranking.horseId.toString())) continue;
    if (ranking.rank > rates.length) continue;
    if (!eligibleGroups.has(ranking.rank)) eligibleGroups.set(ranking.rank, []);
    eligibleGroups.get(ranking.rank)!.push(ranking);
  }

  let distributed = 0;
  const sortedGroups = [...eligibleGroups.entries()].sort((a, b) => a[0] - b[0]);
  for (const [rank, rankings] of sortedGroups) {
    const rankRate = rates[rank - 1] ?? 0;
    if (rankRate <= 0 || rankings.length === 0) continue;

    const rankPrize = pct(prizePool, rankRate);
    const horsePrize = Math.floor(rankPrize / rankings.length);
    distributed += horsePrize * rankings.length;
    for (const ranking of rankings) {
      ranking.prize = horsePrize;
    }
  }

  const remainder = prizePool - distributed;
  const firstEligible = sortedGroups[0]?.[1]?.[0];
  if (remainder > 0 && firstEligible) {
    firstEligible.prize += remainder;
  }
}

export async function settleRacePrizesFromResult(
  result: Pick<IResult, 'raceId' | 'tournamentId' | 'rankings'> & { _id: mongoose.Types.ObjectId },
): Promise<void> {
  const race = await Race.findById(result.raceId).select('name participants').lean();
  if (!race) return;

  const tournament = await Tournament.findById(result.tournamentId)
    .select('prizePool predictionConfig')
    .lean();
  const ownerShareRate = tournament?.predictionConfig.ownerShareRate ?? DEFAULT_OWNER_SHARE_RATE;
  const fixedPrizeRates = resolveFixedPrizeRates(tournament?.predictionConfig);
  assignFixedPrizes(
    result,
    Math.max(0, Math.floor(tournament?.prizePool ?? 0)),
    fixedPrizeRates,
    disqualifiedHorseIdsFromRace(race),
  );

  for (const ranking of result.rankings) {
    const prize = Math.max(0, Math.floor(ranking.prize ?? 0));
    if (prize <= 0) continue;

    const ownerPrize = pct(prize, ownerShareRate);
    const jockeyPrize = prize - ownerPrize;
    const ownerNote = `Thưởng cố định owner hạng ${ranking.rank} cuộc đua ${race.name}`;
    const jockeyNote = `Thưởng cố định jockey hạng ${ranking.rank} cuộc đua ${race.name}`;

    const ownerAwarded = await awardRacePrizePoints(
      ranking.ownerId,
      ownerPrize,
      'earned_race_prize_owner',
      result._id,
      ownerNote,
    );
    const jockeyAwarded = await awardRacePrizePoints(
      ranking.jockeyId,
      jockeyPrize,
      'earned_race_prize_jockey',
      result._id,
      jockeyNote,
    );

    const notifications = [];
    if (ownerAwarded) {
      notifications.push({
        userId: ranking.ownerId,
        type: 'race_prize_reward',
        title: 'Fixed race prize',
        message: `Owner received ${ownerPrize} points for rank ${ranking.rank} in ${race.name}.`,
        refModel: 'Result',
        refId: result._id,
      });
    }
    if (jockeyAwarded) {
      notifications.push({
        userId: ranking.jockeyId,
        type: 'race_prize_reward',
        title: 'Fixed race prize',
        message: `Jockey received ${jockeyPrize} points for rank ${ranking.rank} in ${race.name}.`,
        refModel: 'Result',
        refId: result._id,
      });
    }
    if (notifications.length > 0) await Notification.create(notifications);
  }
}
