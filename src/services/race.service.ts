import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import { Race, type IParticipant, type IRace } from '../models/Race.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { User } from '../models/User.model.js';
import { HttpError } from '../utils/http-error.js';
import type { RaceStatus } from '../types/shared.types.js';
import { activeParticipants, nextLaneNumber, validateParticipants } from '../utils/race-participants.js';
import {
  normalizeViewingTicket,
  type ViewingTicketInput,
} from '../utils/viewing-ticket.js';

const RACE_STATUSES: RaceStatus[] = ['scheduled', 'ongoing', 'completed', 'cancelled'];

export interface CreateRaceInput {
  tournamentId: string;
  name: string;
  round: number;
  raceClass?: string;
  scheduledAt: string | Date;
  distance?: number;
  surface?: IRace['surface'];
  going?: IRace['going'];
  weather?: string;
  predictionOpenAt?: string | Date | null;
  predictionCloseAt?: string | Date | null;
  maxParticipants: number;
  refereeId?: string;
  streamUrl?: string;
  viewingTicket?: ViewingTicketInput;
}

export interface AddParticipantInput {
  horseId: string;
  jockeyId: string;
  ownerId: string;
  laneNumber?: number;
  clothNumber?: number;
}

export async function createRace(input: CreateRaceInput) {
  if (!mongoose.isValidObjectId(input.tournamentId)) {
    throw new HttpError(400, 'tournamentId không hợp lệ');
  }

  const tournamentExists = await Tournament.exists({ _id: input.tournamentId });
  if (!tournamentExists) {
    throw new HttpError(404, 'Giải đấu không tồn tại');
  }

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, 'scheduledAt không hợp lệ');
  }

  const viewingTicket = normalizeViewingTicket(scheduledAt, input.viewingTicket);

  const race = await Race.create({
    ...input,
    tournamentId: new mongoose.Types.ObjectId(input.tournamentId),
    scheduledAt,
    predictionOpenAt: input.predictionOpenAt ? new Date(input.predictionOpenAt) : null,
    predictionCloseAt: input.predictionCloseAt ? new Date(input.predictionCloseAt) : null,
    refereeId: input.refereeId ? new mongoose.Types.ObjectId(input.refereeId) : null,
    viewingTicket,
  });

  return race.toObject();
}

export async function getRacesByTournament(tournamentId: string) {
  if (!mongoose.isValidObjectId(tournamentId)) {
    throw new HttpError(400, 'tournamentId không hợp lệ');
  }

  return Race.find({ tournamentId: new mongoose.Types.ObjectId(tournamentId) })
    .sort({ round: 1, scheduledAt: 1 })
    .lean();
}

export async function getRaceById(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const race = await Race.findById(id)
    .populate('participants.horseId', 'name breed')
    .populate('participants.jockeyId', 'fullName')
    .populate('participants.ownerId', 'fullName')
    .lean();

  if (!race) {
    throw new HttpError(404, 'Không tìm thấy trận đua');
  }

  return race;
}

export async function addParticipantToRace(raceId: string, payload: AddParticipantInput) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const objectIds = [payload.horseId, payload.jockeyId, payload.ownerId];
  if (!objectIds.every((id) => mongoose.isValidObjectId(id))) {
    throw new HttpError(400, 'horseId/jockeyId/ownerId không hợp lệ');
  }

  const [horse, jockey, owner, race] = await Promise.all([
    Horse.findById(payload.horseId).lean(),
    User.findById(payload.jockeyId).select('role isActive').lean(),
    User.findById(payload.ownerId).select('role isActive').lean(),
    Race.findById(raceId),
  ]);

  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');
  if (!horse) throw new HttpError(404, 'Không tìm thấy ngựa');
  if (horse.healthStatus !== 'fit') throw new HttpError(409, 'Ngựa không đủ điều kiện thi đấu');
  if (!jockey?.isActive || jockey.role !== 'jockey') {
    throw new HttpError(400, 'jockeyId phải là tài khoản jockey đang hoạt động');
  }
  if (!owner?.isActive || owner.role !== 'horse_owner') {
    throw new HttpError(400, 'ownerId phải là tài khoản horse_owner đang hoạt động');
  }

  if (race.status === 'cancelled' || race.status === 'completed') {
    throw new HttpError(409, 'Không thể thêm participant vào trận đua đã kết thúc hoặc hủy');
  }

  const laneNumber = payload.laneNumber ?? nextLaneNumber(race.participants);
  const clothNumber = payload.clothNumber ?? laneNumber;

  const participant: IParticipant = {
    horseId: new mongoose.Types.ObjectId(payload.horseId),
    jockeyId: new mongoose.Types.ObjectId(payload.jockeyId),
    ownerId: new mongoose.Types.ObjectId(payload.ownerId),
    laneNumber,
    clothNumber,
    confirmedAt: null,
    vetApprovedAt: null,
    scratchedAt: null,
  };

  const nextParticipants = [...race.participants, participant];
  const participantErr = validateParticipants(nextParticipants, race.maxParticipants);
  if (participantErr) {
    throw new HttpError(409, participantErr);
  }

  race.participants = nextParticipants;
  await race.save();

  return race.toObject();
}

function mapRaceSaveError(err: unknown): HttpError {
  const message = err instanceof Error ? err.message : 'Không thể cập nhật trận đua';
  if (
    message.includes('at least 2 active participants') ||
    message.includes('can only be completed from ongoing')
  ) {
    return new HttpError(409, message);
  }
  if (message.includes('scheduledAt must be in the future')) {
    return new HttpError(400, message);
  }
  if (message.includes('participants')) {
    return new HttpError(409, message);
  }
  return new HttpError(500, message);
}

export async function updateRaceStatus(raceId: string, status: IRace['status']) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }
  if (!RACE_STATUSES.includes(status)) {
    throw new HttpError(400, 'Trạng thái trận đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) {
    throw new HttpError(404, 'Không tìm thấy trận đua');
  }

  if (status === 'ongoing') {
    const activeCount = activeParticipants(race.participants).length;
    if (activeCount < 2) {
      throw new HttpError(
        409,
        'Cần ít nhất 2 ngựa thi đấu đang hoạt động trước khi bắt đầu cuộc đua',
      );
    }
  }

  if (status === 'completed' && race.status !== 'ongoing' && race.status !== 'completed') {
    throw new HttpError(409, 'Chỉ có thể kết thúc cuộc đua khi đang diễn ra');
  }

  race.status = status;
  try {
    await race.save();
  } catch (err) {
    throw mapRaceSaveError(err);
  }

  return race.toObject();
}
