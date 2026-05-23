import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import type { IJockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Race } from '../models/Race.model.js';
import type { IParticipant } from '../models/Race.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { User } from '../models/User.model.js';
import { nextLaneNumber, validateParticipants } from '../utils/race-participants.js';

export async function assertUserRole(
  userId: mongoose.Types.ObjectId,
  role: 'jockey' | 'referee' | 'horse_owner',
): Promise<void> {
  const user = await User.findById(userId).select('role isActive').lean();
  if (!user?.isActive || user.role !== role) {
    throw new Error(`User ${userId} must be an active ${role}`);
  }
}

/**
 * Thêm participant sau khi jockey accept — cần RaceRegistration đã approved.
 */
export async function addParticipantFromInvitation(
  invitation: IJockeyInvitation,
): Promise<IParticipant[]> {
  if (invitation.status !== 'accepted') {
    throw new Error('Invitation must be accepted before adding participant');
  }

  const registration = await RaceRegistration.findOne({
    raceId: invitation.raceId,
    horseId: invitation.horseId,
    ownerId: invitation.horseOwnerId,
    status: 'approved',
  });
  if (!registration) {
    throw new Error('Approved race registration required before adding participant');
  }

  const horse = await Horse.findById(invitation.horseId);
  if (!horse || horse.healthStatus !== 'fit') {
    throw new Error('Horse must exist and be fit to race');
  }

  await assertUserRole(invitation.jockeyId, 'jockey');

  const race = await Race.findById(invitation.raceId);
  if (!race) throw new Error('Race not found');
  if (race.status === 'cancelled') throw new Error('Cannot add participant to cancelled race');
  if (race.participants.length >= race.maxParticipants) {
    throw new Error('Race is full');
  }

  const horseKey = invitation.horseId.toString();
  const jockeyKey = invitation.jockeyId.toString();

  if (race.participants.some((p) => p.horseId.toString() === horseKey)) {
    throw new Error('Horse is already in this race');
  }
  if (race.participants.some((p) => p.jockeyId.toString() === jockeyKey)) {
    throw new Error('Jockey is already assigned in this race');
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
  if (err) throw new Error(err);

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
    throw new Error('Jockey already accepted another invitation for this race');
  }

  await addParticipantFromInvitation(invitation);
}
