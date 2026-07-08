import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { Race } from '../models/Race.model.js';
import type { IResult } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';
import { Tournament } from '../models/Tournament.model.js';
import type { PointsTxType } from '../types/shared.types.js';

const DEFAULT_OWNER_SHARE_RATE = 80;

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

export async function settleRacePrizesFromResult(
  result: Pick<IResult, 'raceId' | 'tournamentId' | 'rankings'> & { _id: mongoose.Types.ObjectId },
): Promise<void> {
  const race = await Race.findById(result.raceId).select('name').lean();
  if (!race) return;

  const tournament = await Tournament.findById(result.tournamentId).select('predictionConfig').lean();
  const ownerShareRate = tournament?.predictionConfig.ownerShareRate ?? DEFAULT_OWNER_SHARE_RATE;

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
