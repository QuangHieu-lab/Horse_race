import mongoose from 'mongoose';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Race, type IRace, type IParticipant } from '../models/Race.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { Track } from '../models/Track.model.js';
import { Horse } from '../models/Horse.model.js';
import { User } from '../models/User.model.js';
import { HttpError } from '../utils/http-error.js';
import type { RaceStatus } from '../types/shared.types.js';
import { validateParticipants } from '../utils/race-participants.js';
import { isPenaltyActive } from '../utils/penalty-status.util.js';
import {
  normalizeViewingTicket,
  type ViewingTicketInput,
} from '../utils/viewing-ticket.js';

const RACE_STATUSES: RaceStatus[] = ['scheduled', 'ready', 'ongoing', 'completed', 'cancelled'];

export interface CreateRaceInput {
  tournamentId: string;
  trackId?: string | null;
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

  // Gắn trường đua (nếu có) và kế thừa mặt sân mặc định của trường
  let trackId: mongoose.Types.ObjectId | null = null;
  let surface = input.surface;
  if (input.trackId) {
    if (!mongoose.isValidObjectId(input.trackId)) {
      throw new HttpError(400, 'trackId không hợp lệ');
    }
    const track = await Track.findById(input.trackId).lean();
    if (!track) throw new HttpError(404, 'Trường đua không tồn tại');
    if (!track.isActive) throw new HttpError(409, 'Trường đua đang ngừng hoạt động');
    trackId = track._id;
    if (!surface) surface = track.surfaceDefault;
  }

  const race = await Race.create({
    ...input,
    tournamentId: new mongoose.Types.ObjectId(input.tournamentId),
    trackId,
    surface,
    scheduledAt,
    predictionOpenAt: input.predictionOpenAt ? new Date(input.predictionOpenAt) : null,
    predictionCloseAt: input.predictionCloseAt ? new Date(input.predictionCloseAt) : null,
    refereeId: input.refereeId ? new mongoose.Types.ObjectId(input.refereeId) : null,
    viewingTicket,
  });

  return race.toObject();
}

/** Admin gán (hoặc bỏ gán) trọng tài phụ trách một cuộc đua. */
export async function assignRaceReferee(raceId: string, refereeId: string | null) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }
  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');

  if (refereeId) {
    if (!mongoose.isValidObjectId(refereeId)) {
      throw new HttpError(400, 'refereeId không hợp lệ');
    }
    const ref = await User.findById(refereeId).select('role isActive').lean();
    if (!ref?.isActive || ref.role !== 'referee') {
      throw new HttpError(400, 'refereeId phải là tài khoản trọng tài đang hoạt động');
    }
    race.refereeId = new mongoose.Types.ObjectId(refereeId);
  } else {
    race.refereeId = null;
  }

  await race.save();
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
    .populate('trackId', 'name location surfaceDefault')
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
    User.findById(payload.jockeyId).select('role isActive jockeyProfile.penaltyStatus').lean(),
    User.findById(payload.ownerId).select('role isActive penaltyStatus').lean(),
    Race.findById(raceId),
  ]);

  if (!race) throw new HttpError(404, 'Không tìm thấy trận đua');
  if (!horse) throw new HttpError(404, 'Không tìm thấy ngựa');
  if (horse.healthStatus !== 'fit') throw new HttpError(409, 'Ngựa không đủ điều kiện thi đấu');
  if (isPenaltyActive(horse.penaltyStatus)) {
    throw new HttpError(403, 'Ngua dang bi tuoc quyen thi dau');
  }
  if (!jockey?.isActive || jockey.role !== 'jockey') {
    throw new HttpError(400, 'jockeyId phải là tài khoản jockey đang hoạt động');
  }
  if (isPenaltyActive(jockey.jockeyProfile?.penaltyStatus)) {
    throw new HttpError(403, 'Nai ngua dang bi tuoc quyen thi dau');
  }
  if (!owner?.isActive || owner.role !== 'horse_owner') {
    throw new HttpError(400, 'ownerId phải là tài khoản horse_owner đang hoạt động');
  }
  if (isPenaltyActive(owner.penaltyStatus)) {
    throw new HttpError(403, 'Chu ngua dang bi tuoc quyen thi dau');
  }

  if (race.status !== 'scheduled') {
    throw new HttpError(409, 'Không thể thêm participant vào trận đua đã kết thúc hoặc hủy');
  }

  const participant: IParticipant = {
    horseId: new mongoose.Types.ObjectId(payload.horseId),
    jockeyId: new mongoose.Types.ObjectId(payload.jockeyId),
    ownerId: new mongoose.Types.ObjectId(payload.ownerId),
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

  const requestedStatus = status as string;
  if (requestedStatus === 'ready' || requestedStatus === 'ongoing') {
    throw new HttpError(403, 'Chi trong tai phu trach moi duoc boc tham lan va bat dau cuoc dua');
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

export async function deleteRace(raceId: string) {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const race = await Race.findById(raceId);
  if (!race) {
    throw new HttpError(404, 'Không tìm thấy trận đua để xóa');
  }

  if (['ready', 'ongoing', 'completed'].includes(race.status)) {
    throw new HttpError(400, 'Không thể xóa trận đua đang diễn ra hoặc đã kết thúc.');
  }

  await Promise.all([
    RaceRegistration.deleteMany({ raceId: race._id }),
    JockeyInvitation.deleteMany({ raceId: race._id }),
  ]);

  await Race.findByIdAndDelete(raceId);
  return true;
}
