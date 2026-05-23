import mongoose from 'mongoose';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { Race } from '../models/Race.model.js';
import { Notification } from '../models/Notification.model.js';
import { Horse } from '../models/Horse.model.js';
import type { RegistrationStatus } from '../types/shared.types.js';
import { ApiError } from '../utils/api-error.js';

export async function createRegistration(
  raceId: string,
  ownerId: string,
  horseId: string,
) {
  const horse = await Horse.findById(horseId);
  if (!horse || horse.ownerId.toString() !== ownerId) {
    throw ApiError.forbidden('Horse not found or not owned by you');
  }

  const race = await Race.findById(raceId);
  if (!race) throw ApiError.notFound('Race not found');
  if (race.status === 'cancelled' || race.status === 'completed') {
    throw ApiError.badRequest('Race is not open for registration');
  }

  const existing = await RaceRegistration.findOne({ raceId, horseId });
  if (existing) throw ApiError.conflict('Horse already registered for this race');

  return RaceRegistration.create({
    raceId,
    horseId,
    ownerId,
    status: 'pending',
    waiverAcceptedAt: new Date(),
  });
}

export async function reviewRegistration(
  registrationId: string,
  adminId: string,
  status: RegistrationStatus,
  adminNote?: string,
) {
  const reg = await RaceRegistration.findById(registrationId);
  if (!reg) throw ApiError.notFound('Registration not found');
  if (reg.status !== 'pending') throw ApiError.conflict('Registration already processed');

  reg.status = status;
  reg.processedBy = new mongoose.Types.ObjectId(adminId);
  reg.processedAt = new Date();
  if (adminNote) reg.adminNote = adminNote;
  await reg.save();

  const race = await Race.findById(reg.raceId);
  const horse = await Horse.findById(reg.horseId);

  if (status === 'approved') {
    await Notification.create({
      userId: reg.ownerId,
      type: 'registration_approved',
      title: 'Đăng ký đã được duyệt',
      message: `${horse?.name ?? 'Ngựa'} được duyệt tham gia ${race?.name ?? 'cuộc đua'}.`,
      refModel: 'RaceRegistration',
      refId: reg._id,
    });
  }

  return reg;
}
