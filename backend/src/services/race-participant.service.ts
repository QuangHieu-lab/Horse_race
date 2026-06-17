import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import type { IJockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Race } from '../models/Race.model.js';
import type { IParticipant } from '../models/Race.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { User } from '../models/User.model.js';
import { HttpError } from '../utils/http-error.js';
import { nextLaneNumber, validateParticipants } from '../utils/race-participants.js';

export async function assertUserRole(
  userId: mongoose.Types.ObjectId,
  role: 'jockey' | 'referee' | 'horse_owner',
): Promise<void> {
  const user = await User.findById(userId).select('role isActive').lean();
  if (!user?.isActive || user.role !== role) {
    throw new HttpError(409, `Người dùng ${userId} phải là ${role} đang hoạt động`);
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

  await assertUserRole(invitation.jockeyId, 'jockey');

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

  const lane = nextLaneNumber(race.participants);
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

  const next = [...race.participants, participant];
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
