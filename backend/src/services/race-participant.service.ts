import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import type { IJockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Race } from '../models/Race.model.js';
import type { IParticipant } from '../models/Race.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { User } from '../models/User.model.js';
import { HttpError } from '../utils/http-error.js';
import { activeParticipants, randomizeActiveParticipantLanes, validateParticipants } from '../utils/race-participants.js';
import { isPenaltyActive } from '../utils/penalty-status.util.js';

export async function assertUserRole(
  userId: mongoose.Types.ObjectId,
  role: 'jockey' | 'referee' | 'horse_owner',
): Promise<void> {
  const user = await User.findById(userId).select('role isActive penaltyStatus jockeyProfile.penaltyStatus').lean();
  if (!user?.isActive || user.role !== role) {
    throw new HttpError(409, `Người dùng ${userId} phải là ${role} đang hoạt động`);
  }
  if (role === 'jockey' && isPenaltyActive(user.jockeyProfile?.penaltyStatus)) {
    throw new HttpError(403, 'Nai ngua dang bi tuoc quyen thi dau');
  }
  if (role === 'horse_owner' && isPenaltyActive(user.penaltyStatus)) {
    throw new HttpError(403, 'Chu ngua dang bi tuoc quyen thi dau');
  }
}

/**
 * Thêm horse + jockey vào Race.participants sau khi jockey ACCEPT lời mời.
 * Yêu cầu đơn đăng ký đã được admin DUYỆT trước đó.
 */
export async function addParticipantFromInvitation(
  invitation: IJockeyInvitation,
): Promise<IParticipant[]> {
  if (invitation.status !== 'accepted') {
    throw new HttpError(409, 'Lời mời phải được chấp nhận trước khi xếp vào đường đua');
  }

  const registration = await RaceRegistration.findOne({
    raceId: invitation.raceId,
    horseId: invitation.horseId,
    ownerId: invitation.horseOwnerId,
    status: 'approved',
  });
  if (!registration) {
    throw new HttpError(409, 'Ngựa chưa được ban tổ chức duyệt cho cuộc đua này');
  }

  const horse = await Horse.findById(invitation.horseId);
  if (!horse || horse.healthStatus !== 'fit') {
    throw new HttpError(409, 'Ngựa phải tồn tại và đủ sức khỏe để đua');
  }

  if (isPenaltyActive(horse.penaltyStatus)) {
    throw new HttpError(403, 'Ngua dang bi tuoc quyen thi dau');
  }

  await assertUserRole(invitation.jockeyId, 'jockey');
  await assertUserRole(invitation.horseOwnerId, 'horse_owner');

  const race = await Race.findById(invitation.raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.status === 'cancelled') throw new HttpError(409, 'Không thể xếp vào cuộc đua đã hủy');
  if (race.participants.length >= race.maxParticipants) {
    throw new HttpError(409, 'Cuộc đua đã đủ số lượng tham gia');
  }

  const horseKey = invitation.horseId.toString();
  const jockeyKey = invitation.jockeyId.toString();

  if (race.participants.some((p) => p.horseId.toString() === horseKey)) {
    throw new HttpError(409, 'Ngựa đã có trong cuộc đua này');
  }
  if (race.participants.some((p) => p.jockeyId.toString() === jockeyKey)) {
    throw new HttpError(409, 'Nài ngựa đã được xếp trong cuộc đua này');
  }

  const lane = activeParticipants(race.participants).length + 1;
  const participant: IParticipant = {
    horseId: invitation.horseId,
    jockeyId: invitation.jockeyId,
    ownerId: invitation.horseOwnerId,
    laneNumber: lane,
    clothNumber: lane,
    confirmedAt: null,
    vetApprovedAt: null,
    scratchedAt: null,
  };

  const next = randomizeActiveParticipantLanes([...race.participants, participant]);
  const err = validateParticipants(next, race.maxParticipants);
  if (err) throw new HttpError(409, err);

  race.participants = next;
  await race.save();

  if (!registration.jockeyId) {
    registration.jockeyId = invitation.jockeyId;
    await registration.save();
  }

  horse.currentJockeyId = invitation.jockeyId;
  await horse.save();

  return race.participants;
}

export interface AddParticipantInput {
  horseId: string;
  jockeyId: string;
  ownerId: string;
  laneNumber?: number;
  clothNumber?: number;
  carriedWeight?: number;
}

/**
 * Thêm trực tiếp horse + jockey vào Race.participants từ dữ liệu request
 * (không qua luồng lời mời). Dùng cho thao tác xếp đường đua thủ công của BTC.
 */
export async function addParticipant(
  raceId: string,
  input: AddParticipantInput,
): Promise<IParticipant[]> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }
  if (!mongoose.isValidObjectId(input.horseId)) {
    throw new HttpError(400, 'horseId không hợp lệ');
  }
  if (!mongoose.isValidObjectId(input.jockeyId)) {
    throw new HttpError(400, 'jockeyId không hợp lệ');
  }
  if (!mongoose.isValidObjectId(input.ownerId)) {
    throw new HttpError(400, 'ownerId không hợp lệ');
  }

  const horseId = new mongoose.Types.ObjectId(input.horseId);
  const jockeyId = new mongoose.Types.ObjectId(input.jockeyId);
  const ownerId = new mongoose.Types.ObjectId(input.ownerId);

  const race = await Race.findById(raceId);
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');
  if (race.status !== 'scheduled') {
    throw new HttpError(409, 'Chỉ có thể thêm ngựa vào cuộc đua chưa bắt đầu');
  }
  if (race.participants.length >= race.maxParticipants) {
    throw new HttpError(409, 'Cuộc đua đã đủ số lượng tham gia');
  }

  const horse = await Horse.findById(horseId);
  if (!horse || horse.healthStatus !== 'fit') {
    throw new HttpError(409, 'Ngựa phải tồn tại và đủ sức khỏe để đua');
  }

  if (isPenaltyActive(horse.penaltyStatus)) {
    throw new HttpError(403, 'Ngua dang bi tuoc quyen thi dau');
  }

  await assertUserRole(jockeyId, 'jockey');
  await assertUserRole(ownerId, 'horse_owner');

  const horseKey = horseId.toString();
  const jockeyKey = jockeyId.toString();
  if (race.participants.some((p) => p.horseId.toString() === horseKey)) {
    throw new HttpError(409, 'Ngựa đã có trong cuộc đua này');
  }
  if (race.participants.some((p) => p.jockeyId.toString() === jockeyKey)) {
    throw new HttpError(409, 'Nài ngựa đã được xếp trong cuộc đua này');
  }

  const lane = activeParticipants(race.participants).length + 1;
  const participant: IParticipant = {
    horseId,
    jockeyId,
    ownerId,
    laneNumber: lane,
    clothNumber: input.clothNumber ?? lane,
    carriedWeight: input.carriedWeight,
    confirmedAt: null,
    vetApprovedAt: null,
    scratchedAt: null,
  };

  const next = randomizeActiveParticipantLanes([...race.participants, participant]);
  const err = validateParticipants(next, race.maxParticipants);
  if (err) throw new HttpError(409, err);

  race.participants = next;
  await race.save();

  horse.currentJockeyId = jockeyId;
  await horse.save();

  return race.participants;
}

/**
 * Gọi từ hook JockeyInvitation khi chuyển sang accepted.
 * Kiểm tra ràng buộc + xếp ngựa/nài vào đường đua (đơn đã được duyệt trước đó).
 */
export async function onInvitationAccepted(
  invitation: IJockeyInvitation,
): Promise<void> {
  const otherAccepted = await mongoose.model<IJockeyInvitation>('JockeyInvitation').countDocuments({
    raceId: invitation.raceId,
    jockeyId: invitation.jockeyId,
    status: 'accepted',
    _id: { $ne: invitation._id },
  });
  if (otherAccepted > 0) {
    throw new HttpError(
      409,
      'Bạn đã chấp nhận một lời mời khác cho cuộc đua này rồi.',
    );
  }

  await addParticipantFromInvitation(invitation);
}

export interface RaceEligibleEntry {
  registrationId: string;
  horseId: string;
  horseName: string;
  ownerId: string;
  ownerName: string;
  jockeyId: string | null;
  jockeyName: string | null;
}

/**
 * Liệt kê các đơn đăng ký đã được admin DUYỆT cho cuộc đua nhưng chưa được
 * xếp vào đường đua. Admin chọn từ danh sách này thay vì nhập ID thủ công.
 * Jockey lấy từ đơn đăng ký, nếu chưa có thì dò lời mời đã được chấp nhận.
 */
export async function listEligibleEntries(raceId: string): Promise<RaceEligibleEntry[]> {
  if (!mongoose.isValidObjectId(raceId)) {
    throw new HttpError(400, 'ID trận đua không hợp lệ');
  }

  const race = await Race.findById(raceId).select('participants').lean();
  if (!race) throw new HttpError(404, 'Không tìm thấy cuộc đua');

  const takenHorseIds = new Set(
    activeParticipants(race.participants).map((p) => p.horseId.toString()),
  );

  const registrations = await RaceRegistration.find({
    raceId: new mongoose.Types.ObjectId(raceId),
    status: 'approved',
  })
    .populate('horseId', 'name')
    .populate('ownerId', 'fullName')
    .populate('jockeyId', 'fullName')
    .lean();

  const entries: RaceEligibleEntry[] = [];
  for (const reg of registrations) {
    const horse = reg.horseId as unknown as
      | { _id: mongoose.Types.ObjectId; name: string }
      | null;
    const owner = reg.ownerId as unknown as
      | { _id: mongoose.Types.ObjectId; fullName: string }
      | null;
    // Bỏ đơn mồ côi (ngựa/chủ đã bị xóa) hoặc ngựa đã ở trong đường đua
    if (!horse || !owner) continue;
    if (takenHorseIds.has(horse._id.toString())) continue;

    let jockey = reg.jockeyId as unknown as
      | { _id: mongoose.Types.ObjectId; fullName: string }
      | null;
    if (!jockey) {
      const invite = await JockeyInvitation.findOne({
        raceId: new mongoose.Types.ObjectId(raceId),
        horseId: horse._id,
        status: 'accepted',
      })
        .populate('jockeyId', 'fullName')
        .lean();
      jockey = (invite?.jockeyId as unknown as
        | { _id: mongoose.Types.ObjectId; fullName: string }
        | null) ?? null;
    }

    entries.push({
      registrationId: reg._id.toString(),
      horseId: horse._id.toString(),
      horseName: horse.name,
      ownerId: owner._id.toString(),
      ownerName: owner.fullName,
      jockeyId: jockey?._id.toString() ?? null,
      jockeyName: jockey?.fullName ?? null,
    });
  }

  return entries;
}
