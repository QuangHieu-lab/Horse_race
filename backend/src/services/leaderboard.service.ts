import mongoose from 'mongoose';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { Horse } from '../models/Horse.model.js';
import { User } from '../models/User.model.js';
import { HttpError } from '../utils/http-error.js';

export interface LeaderboardRankingDto {
  rank: number;
  horse: { id: string; name: string };
  jockey: { id: string; fullName: string };
  owner: { id: string; fullName: string };
  finishTime: number | null;
  marginBehind: number | null;
  prize: number;
  isDeadHeat: boolean;
  isDisqualified: boolean;
}

export interface RaceLeaderboardDto {
  raceId: string;
  raceName: string;
  round: number;
  distance: number | null;
  tournamentId: string;
  tournamentName: string | null;
  raceStatus: string;
  /** 'published' | 'confirmed' cho biết bảng đang ở giai đoạn nào; null = chưa được phép xem. */
  stage: 'published' | 'confirmed' | null;
  publishedAt: string | null;
  confirmedAt: string | null;
  rankings: LeaderboardRankingDto[];
}

const INTERNAL_ROLES = new Set(['admin', 'referee']);

/**
 * Bảng xếp hạng dùng chung cho mọi role.
 * - public (owner/jockey/spectator): chỉ thấy khi kết quả đã publish.
 * - nội bộ (admin/referee): thấy được cả bản đã xác nhận (confirmed) nhưng chưa publish.
 */
export async function getRaceLeaderboard(
  raceId: string,
  role: string,
): Promise<RaceLeaderboardDto> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId)
    .populate('tournamentId', 'name')
    .lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const tournament = race.tournamentId as unknown as
    | { _id: mongoose.Types.ObjectId; name: string }
    | null;

  const base: RaceLeaderboardDto = {
    raceId: race._id.toString(),
    raceName: race.name,
    round: race.round,
    distance: race.distance ?? null,
    tournamentId: tournament?._id?.toString() ?? '',
    tournamentName: tournament?.name ?? null,
    raceStatus: race.status,
    stage: null,
    publishedAt: null,
    confirmedAt: null,
    rankings: [],
  };

  const result = await Result.findOne({ raceId: race._id }).lean();
  if (!result || result.rankings.length === 0) return base;

  const isInternal = INTERNAL_ROLES.has(role);
  const isPublished = !!result.publishedAt;
  const isConfirmed = !!result.confirmedAt;

  // Cổng hiển thị theo role.
  const stage: 'published' | 'confirmed' | null = isPublished
    ? 'published'
    : isInternal && isConfirmed
      ? 'confirmed'
      : null;
  if (!stage) return base; // chưa đến giai đoạn role này được xem

  // Ngựa bị tước quyền (DQ) lấy từ participants của race.
  const dqHorseIds = new Set(
    race.participants
      .filter((p) => (p as { isDisqualified?: boolean }).isDisqualified)
      .map((p) => p.horseId.toString()),
  );

  const horseIds = result.rankings.map((r) => r.horseId);
  const userIds = [
    ...result.rankings.map((r) => r.jockeyId),
    ...result.rankings.map((r) => r.ownerId),
  ];

  const [horses, users] = await Promise.all([
    Horse.find({ _id: { $in: horseIds } }).select('name').lean(),
    User.find({ _id: { $in: userIds } }).select('fullName').lean(),
  ]);
  const horseMap = new Map(horses.map((h) => [h._id.toString(), h.name]));
  const userMap = new Map(users.map((u) => [u._id.toString(), u.fullName]));

  const rankings: LeaderboardRankingDto[] = result.rankings
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((r) => {
      const hid = r.horseId.toString();
      return {
        rank: r.rank,
        horse: { id: hid, name: horseMap.get(hid) ?? 'Không rõ' },
        jockey: {
          id: r.jockeyId.toString(),
          fullName: userMap.get(r.jockeyId.toString()) ?? 'Không rõ',
        },
        owner: {
          id: r.ownerId.toString(),
          fullName: userMap.get(r.ownerId.toString()) ?? 'Không rõ',
        },
        finishTime: r.finishTime ?? null,
        marginBehind: r.marginBehind ?? null,
        prize: r.prize ?? 0,
        isDeadHeat: !!r.isDeadHeat,
        isDisqualified: dqHorseIds.has(hid),
      };
    });

  return {
    ...base,
    stage,
    publishedAt: result.publishedAt?.toISOString() ?? null,
    confirmedAt: result.confirmedAt?.toISOString() ?? null,
    rankings,
  };
}
