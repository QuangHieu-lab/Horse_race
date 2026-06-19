import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Notification } from '../models/Notification.model.js';
import { Race } from '../models/Race.model.js';
import { Result } from '../models/Result.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { User } from '../models/User.model.js';
import type {
  InvitationDto,
  JockeyDashboardDto,
  JockeyRaceDto,
} from '../types/api.types.js';
import type { InvitationStatus } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';

function toInvitationDto(
  inv: {
    _id: mongoose.Types.ObjectId;
    status: InvitationStatus;
    message?: string;
    respondedAt?: Date | null;
    createdAt: Date;
    horseId: { _id: mongoose.Types.ObjectId; name: string } | mongoose.Types.ObjectId;
    raceId:
      | {
          _id: mongoose.Types.ObjectId;
          name: string;
          scheduledAt: Date;
          status: string;
        }
      | mongoose.Types.ObjectId;
    horseOwnerId: { _id: mongoose.Types.ObjectId; fullName: string } | mongoose.Types.ObjectId;
  },
): InvitationDto {
  const horse = inv.horseId as { _id: mongoose.Types.ObjectId; name: string };
  const race = inv.raceId as {
    _id: mongoose.Types.ObjectId;
    name: string;
    scheduledAt: Date;
    status: string;
  };
  const owner = inv.horseOwnerId as { _id: mongoose.Types.ObjectId; fullName: string };

  return {
    id: inv._id.toString(),
    status: inv.status,
    message: inv.message,
    respondedAt: inv.respondedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    horse: { id: horse._id.toString(), name: horse.name },
    race: {
      id: race._id.toString(),
      name: race.name,
      scheduledAt: race.scheduledAt.toISOString(),
      status: race.status as InvitationDto['race']['status'],
    },
    owner: { id: owner._id.toString(), fullName: owner.fullName },
  };
}

export async function listInvitations(
  jockeyId: string,
  status?: InvitationStatus,
): Promise<InvitationDto[]> {
  const filter: Record<string, unknown> = {
    jockeyId: new mongoose.Types.ObjectId(jockeyId),
  };
  if (status) filter.status = status;

  const invitations = await JockeyInvitation.find(filter)
    .populate('horseId', 'name')
    .populate('raceId', 'name scheduledAt status')
    .populate('horseOwnerId', 'fullName')
    .sort({ createdAt: -1 })
    .lean();

  return invitations.map((inv) => toInvitationDto(inv as Parameters<typeof toInvitationDto>[0]));
}

export async function respondToInvitation(
  jockeyId: string,
  invitationId: string,
  action: 'accept' | 'decline',
): Promise<InvitationDto> {
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new HttpError(400, 'ID lời mời không hợp lệ');
  }

  const invitation = await JockeyInvitation.findOne({
    _id: invitationId,
    jockeyId: new mongoose.Types.ObjectId(jockeyId),
  });

  if (!invitation) {
    throw new HttpError(404, 'Không tìm thấy lời mời');
  }
  if (invitation.status !== 'pending') {
    throw new HttpError(409, 'Lời mời đã được phản hồi');
  }

  if (action === 'decline') {
    invitation.status = 'declined';
    invitation.respondedAt = new Date();
    await invitation.save();

    const horse = await Horse.findById(invitation.horseId).select('name').lean();
    const race = await Race.findById(invitation.raceId).select('name').lean();
    await Notification.create({
      userId: invitation.horseOwnerId,
      type: 'invitation_declined',
      title: 'Jockey từ chối lời mời',
      message: `Kỵ sĩ đã từ chối điều khiển ${horse?.name ?? 'ngựa'} tại ${race?.name ?? 'cuộc đua'}.`,
      refModel: 'JockeyInvitation',
      refId: invitation._id,
    });
  } else {
    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    try {
      // Hook sẽ xếp ngựa/nài vào đường đua (đơn đã được duyệt) và gán jockeyId.
      await invitation.save();
    } catch (err) {
      // Lỗi nghiệp vụ từ hook (vd: chưa duyệt ngựa, đã nhận lời mời khác…) → thông báo rõ ràng.
      if (err instanceof HttpError) throw err;
      throw new HttpError(409, err instanceof Error ? err.message : 'Không thể chấp nhận lời mời');
    }

    const horse = await Horse.findById(invitation.horseId).select('name').lean();
    const race = await Race.findById(invitation.raceId).select('name').lean();
    const jockey = await User.findById(jockeyId).select('fullName').lean();
    await Notification.create({
      userId: invitation.horseOwnerId,
      type: 'invitation_accepted',
      title: 'Jockey chấp nhận lời mời',
      message: `${jockey?.fullName ?? 'Kỵ sĩ'} đã chấp nhận điều khiển ${horse?.name ?? 'ngựa'} tại ${race?.name ?? 'cuộc đua'}.`,
      refModel: 'JockeyInvitation',
      refId: invitation._id,
    });
  }

  const updated = await JockeyInvitation.findById(invitation._id)
    .populate('horseId', 'name')
    .populate('raceId', 'name scheduledAt status')
    .populate('horseOwnerId', 'fullName')
    .lean();

  if (!updated) throw new HttpError(500, 'Lỗi cập nhật lời mời');
  return toInvitationDto(updated as Parameters<typeof toInvitationDto>[0]);
}

async function buildJockeyRaceDto(
  race: {
    _id: mongoose.Types.ObjectId;
    name: string;
    round: number;
    scheduledAt: Date;
    status: string;
    distance?: number;
    tournamentId: mongoose.Types.ObjectId;
    participants: Array<{
      horseId: mongoose.Types.ObjectId;
      jockeyId: mongoose.Types.ObjectId;
      ownerId: mongoose.Types.ObjectId;
      laneNumber: number;
      confirmedAt?: Date | null;
    }>;
  },
  jockeyObjectId: mongoose.Types.ObjectId,
): Promise<JockeyRaceDto | null> {
  const participant = race.participants.find(
    (p) => p.jockeyId.toString() === jockeyObjectId.toString(),
  );
  if (!participant) return null;

  const [horse, owner, tournament, result] = await Promise.all([
    Horse.findById(participant.horseId).select('name').lean(),
    User.findById(participant.ownerId).select('fullName').lean(),
    Tournament.findById(race.tournamentId).select('name').lean(),
    Result.findOne({ raceId: race._id, publishedAt: { $ne: null } }).lean(),
  ]);

  if (!horse || !owner || !tournament) return null;

  let resultDto: JockeyRaceDto['result'] = null;
  if (result) {
    const horseIds = result.rankings.map((r) => r.horseId);
    const jockeyIds = result.rankings.map((r) => r.jockeyId);
    const [horses, jockeys] = await Promise.all([
      Horse.find({ _id: { $in: horseIds } }).select('name').lean(),
      User.find({ _id: { $in: jockeyIds } }).select('fullName').lean(),
    ]);
    const horseMap = new Map(horses.map((h) => [h._id.toString(), h.name]));
    const jockeyMap = new Map(jockeys.map((j) => [j._id.toString(), j.fullName]));

    resultDto = {
      id: result._id.toString(),
      publishedAt: result.publishedAt?.toISOString() ?? null,
      rankings: result.rankings.map((r) => ({
        rank: r.rank,
        horse: {
          id: r.horseId.toString(),
          name: horseMap.get(r.horseId.toString()) ?? 'Unknown',
        },
        jockey: {
          id: r.jockeyId.toString(),
          fullName: jockeyMap.get(r.jockeyId.toString()) ?? 'Unknown',
        },
        finishTime: r.finishTime,
        prize: r.prize,
      })),
    };
  }

  return {
    id: race._id.toString(),
    name: race.name,
    round: race.round,
    scheduledAt: race.scheduledAt.toISOString(),
    status: race.status as JockeyRaceDto['status'],
    distance: race.distance,
    tournament: { id: tournament._id.toString(), name: tournament.name },
    participant: {
      horse: { id: horse._id.toString(), name: horse.name },
      owner: { id: owner._id.toString(), fullName: owner.fullName },
      laneNumber: participant.laneNumber,
      confirmedAt: participant.confirmedAt?.toISOString() ?? null,
    },
    result: resultDto,
  };
}

export async function listJockeyRaces(jockeyId: string): Promise<JockeyRaceDto[]> {
  const jockeyObjectId = new mongoose.Types.ObjectId(jockeyId);
  const races = await Race.find({ 'participants.jockeyId': jockeyObjectId })
    .sort({ scheduledAt: -1 })
    .lean();

  const dtos: JockeyRaceDto[] = [];
  for (const race of races) {
    const dto = await buildJockeyRaceDto(race, jockeyObjectId);
    if (dto) dtos.push(dto);
  }
  return dtos;
}

export async function getJockeyRace(
  jockeyId: string,
  raceId: string,
): Promise<JockeyRaceDto> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID cuộc đua không hợp lệ');
  }

  const race = await Race.findById(raceId).lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const dto = await buildJockeyRaceDto(
    race,
    new mongoose.Types.ObjectId(jockeyId),
  );
  if (!dto) throw new HttpError(404, 'Bạn không tham gia cuộc đua này');
  return dto;
}

export async function getJockeyDashboard(jockeyId: string): Promise<JockeyDashboardDto> {
  const jockeyObjectId = new mongoose.Types.ObjectId(jockeyId);
  const now = new Date();

  const [pendingInvitations, races] = await Promise.all([
    JockeyInvitation.countDocuments({ jockeyId: jockeyObjectId, status: 'pending' }),
    Race.find({ 'participants.jockeyId': jockeyObjectId }).select('status scheduledAt').lean(),
  ]);

  let upcomingRaces = 0;
  let completedRaces = 0;
  for (const race of races) {
    if (race.status === 'completed' || race.status === 'cancelled') {
      completedRaces++;
    } else if (race.scheduledAt >= now || race.status === 'ongoing') {
      upcomingRaces++;
    }
  }

  return { pendingInvitations, upcomingRaces, completedRaces };
}
