import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import type { RegistrationStatus } from '../types/shared.types.js';
import type { RegistrationDto } from '../types/api.types.js';
import { HttpError } from '../utils/http-error.js';

function toRegistrationDto(reg: {
  _id: mongoose.Types.ObjectId;
  status: RegistrationStatus;
  horseId: {
    _id: mongoose.Types.ObjectId;
    name: string;
    healthStatus: string;
    breed?: string;
    age?: number;
    profilePdfUrl?: string;
    profilePdfName?: string;
  };
  raceId: {
    _id: mongoose.Types.ObjectId;
    name: string;
    round: number;
    status: string;
    scheduledAt?: Date;
  };
  ownerId?: { _id: mongoose.Types.ObjectId; fullName: string } | null;
  jockeyId?: { _id: mongoose.Types.ObjectId; fullName: string } | null;
  processedBy?: { _id: mongoose.Types.ObjectId; fullName: string } | null;
  processedAt?: Date | null;
  waiverAcceptedAt?: Date | null;
  adminNote?: string | null;
  createdAt: Date;
}): RegistrationDto {
  return {
    id: reg._id.toString(),
    status: reg.status,
    horse: {
      id: reg.horseId._id.toString(),
      name: reg.horseId.name,
      healthStatus: reg.horseId.healthStatus as RegistrationDto['horse']['healthStatus'],
      breed: reg.horseId.breed,
      age: reg.horseId.age,
      profilePdfUrl: reg.horseId.profilePdfUrl,
      profilePdfName: reg.horseId.profilePdfName,
    },
    race: {
      id: reg.raceId._id.toString(),
      name: reg.raceId.name,
      round: reg.raceId.round,
      status: reg.raceId.status as RegistrationDto['race']['status'],
      scheduledAt: reg.raceId.scheduledAt?.toISOString(),
    },
    owner: reg.ownerId
      ? { id: reg.ownerId._id.toString(), fullName: reg.ownerId.fullName }
      : null,
    jockey: reg.jockeyId
      ? { id: reg.jockeyId._id.toString(), fullName: reg.jockeyId.fullName }
      : null,
    processedBy: reg.processedBy
      ? { id: reg.processedBy._id.toString(), fullName: reg.processedBy.fullName }
      : null,
    processedAt: reg.processedAt?.toISOString() ?? null,
    waiverAcceptedAt: reg.waiverAcceptedAt?.toISOString() ?? null,
    adminNote: reg.adminNote ?? null,
    createdAt: reg.createdAt.toISOString(),
  };
}

export async function listRegistrations(
  status?: RegistrationStatus,
): Promise<RegistrationDto[]> {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const items = await RaceRegistration.find(filter)
    .populate('raceId', 'name round status scheduledAt')
    .populate('horseId', 'name healthStatus breed age profilePdfUrl profilePdfName')
    .populate('ownerId', 'fullName')
    .populate('jockeyId', 'fullName')
    .populate('processedBy', 'fullName')
    .sort({ createdAt: -1 })
    .lean();

  // Bỏ qua đơn mồ côi (ngựa hoặc cuộc đua đã bị xóa)
  return items
    .filter((r) => r.raceId && r.horseId)
    .map((r) => toRegistrationDto(r as unknown as Parameters<typeof toRegistrationDto>[0]));
}

export async function updateRegistrationStatus(
  adminId: string,
  registrationId: string,
  status: 'approved' | 'rejected',
  adminNote?: string,
): Promise<RegistrationDto> {
  if (!mongoose.isValidObjectId(registrationId)) {
    throw new HttpError(400, 'ID đơn đăng ký không hợp lệ');
  }

  const reg = await RaceRegistration.findById(registrationId);
  if (!reg) throw new HttpError(404, 'Không tìm thấy đơn đăng ký');
  if (reg.status !== 'pending') {
    throw new HttpError(409, 'Đơn đăng ký đã được xử lý');
  }

  reg.status = status;
  reg.processedBy = new mongoose.Types.ObjectId(adminId);
  reg.processedAt = new Date();
  if (adminNote) reg.adminNote = adminNote;
  await reg.save();

  await Notification.create({
    userId: reg.ownerId,
    type: status === 'approved' ? 'registration_approved' : 'registration_rejected',
    title: status === 'approved' ? 'Đăng ký được duyệt' : 'Đăng ký bị từ chối',
    message:
      status === 'approved'
        ? 'Đơn đăng ký ngựa của bạn đã được ban tổ chức phê duyệt.'
        : 'Đơn đăng ký ngựa của bạn đã bị từ chối.',
    refModel: 'RaceRegistration',
    refId: reg._id,
  });

  const populated = await RaceRegistration.findById(reg._id)
    .populate('raceId', 'name round status scheduledAt')
    .populate('horseId', 'name healthStatus breed age profilePdfUrl profilePdfName')
    .populate('ownerId', 'fullName')
    .populate('jockeyId', 'fullName')
    .populate('processedBy', 'fullName')
    .lean();

  if (!populated) throw new HttpError(500, 'Lỗi cập nhật đơn');
  return toRegistrationDto(populated as unknown as Parameters<typeof toRegistrationDto>[0]);
}
