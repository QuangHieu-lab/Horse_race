import mongoose from 'mongoose';
import { Horse } from '../models/Horse.model.js';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Notification } from '../models/Notification.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { HttpError } from '../utils/http-error.js';
// Giả định bạn đã khai báo các DTO này trong thư mục types
import type { HorseDto, RegistrationDto, InvitationDto } from '../types/api.types.js';

// ============================================================================
// 1. INPUT INTERFACES (Định nghĩa dữ liệu đầu vào rõ ràng)
// ============================================================================
export interface CreateHorseInput {
  name: string;
  registrationId?: string;
  breed: string;
  age: number;
  weight?: number;
  color?: string;
  trainerName?: string;
}

export interface RegisterRaceInput {
  raceId: string;
  horseId: string;
}

export interface InviteJockeyInput {
  raceId: string;
  horseId: string;
  jockeyId: string;
  message?: string;
}

// ============================================================================
// 2. DTO MAPPERS (Hàm chuẩn hóa dữ liệu trả về)
// ============================================================================
function toHorseDto(horse: any): HorseDto {
  return {
    id: horse._id.toString(),
    registrationId: horse.registrationId, // Bổ sung trường này
    name: horse.name,
    breed: horse.breed,
    age: horse.age,
    weight: horse.weight,
    color: horse.color,
    healthStatus: horse.healthStatus,
    currentJockey: horse.currentJockeyId ? {
      id: horse.currentJockeyId._id.toString(),
      fullName: horse.currentJockeyId.fullName,
    } : null,
    createdAt: horse.createdAt?.toISOString(),
  };
}

function toRegistrationDto(reg: any): RegistrationDto {
  return {
    id: reg._id.toString(),
    status: reg.status,
    horse: {
      id: reg.horseId._id.toString(),
      name: reg.horseId.name,
      healthStatus: reg.horseId.healthStatus,
    },
    race: {
      id: reg.raceId._id.toString(),
      name: reg.raceId.name,
      round: reg.raceId.round,
      status: reg.raceId.status,
      scheduledAt: reg.raceId.scheduledAt?.toISOString(),
    },
    jockey: reg.jockeyId ? {
      id: reg.jockeyId._id.toString(),
      fullName: reg.jockeyId.fullName,
    } : null,
    // Bổ sung map dữ liệu mới
    processedBy: reg.processedBy ? {
      id: reg.processedBy._id.toString(),
      fullName: reg.processedBy.fullName || 'Ban Tổ Chức',
    } : null,
    processedAt: reg.processedAt?.toISOString() ?? null,
    waiverAcceptedAt: reg.waiverAcceptedAt?.toISOString() ?? null,
    createdAt: reg.createdAt?.toISOString(),
  };
}
 
function toInvitationDto(inv: any): InvitationDto {
  return {
    id: inv._id.toString(),
    status: inv.status,
    message: inv.message,
    respondedAt: inv.respondedAt?.toISOString() ?? null,
    createdAt: inv.createdAt?.toISOString(),
    horse: {
      id: inv.horseId._id.toString(),
      name: inv.horseId.name,
    },
    race: {
      id: inv.raceId._id.toString(),
      name: inv.raceId.name,
      scheduledAt: inv.raceId.scheduledAt?.toISOString(),
      status: inv.raceId.status,
    },
    owner: {
      id: inv.horseOwnerId._id.toString(),
      fullName: inv.horseOwnerId.fullName,
    },
    // Map thêm dữ liệu Nài ngựa
    jockey: inv.jockeyId ? {
      id: inv.jockeyId._id.toString(),
      fullName: inv.jockeyId.fullName,
    } : null,
  };
}
// ============================================================================
// 3. MAIN SERVICE
// ============================================================================
export class HorseOwnerService {
  
  // --- QUẢN LÝ NGỰA ---

  async createHorse(ownerId: string, input: CreateHorseInput): Promise<HorseDto> {
    const horse = await Horse.create({
      ...input,
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    // Mặc định lúc mới tạo, currentJockeyId sẽ là null do cấu hình Mongoose
    const populatedHorse = await Horse.findById(horse._id)
      .populate('currentJockeyId', 'fullName')
      .lean();

    if (!populatedHorse) throw new HttpError(500, 'Lỗi hệ thống');
    return toHorseDto(populatedHorse);
  }
  async getMyHorses(ownerId: string, healthStatus?: string): Promise<HorseDto[]> {
    const query: Record<string, unknown> = { ownerId: new mongoose.Types.ObjectId(ownerId) };
    if (healthStatus) query.healthStatus = healthStatus;

    // Dùng .lean() để tăng tốc độ query, không sinh ra Mongoose Document thừa
    const horses = await Horse.find(query)
      .populate('currentJockeyId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    return horses.map(toHorseDto);
  }

  async updateHorse(ownerId: string, horseId: string, input: Partial<CreateHorseInput>): Promise<HorseDto> {
    if (!mongoose.isValidObjectId(horseId)) throw new HttpError(400, 'ID ngựa không hợp lệ');

    const horse = await Horse.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(horseId), ownerId: new mongoose.Types.ObjectId(ownerId) },
      input,
      { new: true, runValidators: true }
    )
    .populate('currentJockeyId', 'fullName')
    .lean();

    if (!horse) throw new HttpError(404, 'Không tìm thấy hồ sơ ngựa');

    return toHorseDto(horse);
  }

  // --- ĐĂNG KÝ GIẢI ĐẤU ---

  async registerForRace(ownerId: string, input: RegisterRaceInput): Promise<RegistrationDto> {
    const { raceId, horseId } = input;
    if (!mongoose.isValidObjectId(raceId) || !mongoose.isValidObjectId(horseId)) {
      throw new HttpError(400, 'ID không hợp lệ');
    }

    // Unique index sẽ lo việc chặn trùng lặp, nên ta gọi create luôn
    const registration = await RaceRegistration.create({
      raceId: new mongoose.Types.ObjectId(raceId),
      horseId: new mongoose.Types.ObjectId(horseId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: 'pending',
      waiverAcceptedAt: new Date(),
    });

    // Populate thủ công để DTO mapper có đủ dữ liệu
    const populatedReg = await RaceRegistration.findById(registration._id)
      .populate('raceId', 'name round status scheduledAt')
      .populate('horseId', 'name healthStatus')
      .lean();

    return toRegistrationDto(populatedReg);
  }

  async getMyRegistrations(ownerId: string, status?: string): Promise<RegistrationDto[]> {
    const query: Record<string, unknown> = { ownerId: new mongoose.Types.ObjectId(ownerId) };
    if (status) query.status = status;

    const registrations = await RaceRegistration.find(query)
      .populate('raceId', 'name round scheduledAt status')
      .populate('horseId', 'name healthStatus')
      .populate('jockeyId', 'fullName')
      .populate('processedBy', 'fullName') // Thêm dòng này để lấy tên Admin
      .sort({ createdAt: -1 })
      .lean();

    return registrations.map(toRegistrationDto);
  }
  async cancelRegistration(ownerId: string, registrationId: string): Promise<void> {
    if (!mongoose.isValidObjectId(registrationId)) throw new HttpError(400, 'ID đơn đăng ký không hợp lệ');

    const result = await RaceRegistration.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(registrationId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: 'pending',
    }).lean();

    if (!result) throw new HttpError(404, 'Không tìm thấy đơn đăng ký, hoặc đơn đã được duyệt');
  }

  // --- THUÊ JOCKEY ---

  async inviteJockey(ownerId: string, input: InviteJockeyInput): Promise<InvitationDto> {
    const { raceId, horseId, jockeyId, message } = input;

    // 1. Validation Logic
    const registration = await RaceRegistration.findOne({
      raceId: new mongoose.Types.ObjectId(raceId),
      horseId: new mongoose.Types.ObjectId(horseId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: 'approved',
    }).lean();

    if (!registration) {
      throw new HttpError(403, 'Ngựa của bạn chưa được duyệt cho trận đua này');
    }

    // 2. Tạo lời mời
    const invitation = await JockeyInvitation.create({
      horseOwnerId: new mongoose.Types.ObjectId(ownerId),
      jockeyId: new mongoose.Types.ObjectId(jockeyId),
      horseId: new mongoose.Types.ObjectId(horseId),
      raceId: new mongoose.Types.ObjectId(raceId),
      message: message,
    });

    // 3. Side Effect: Bắn thông báo
    await Notification.create({
      userId: invitation.jockeyId,
      type: 'invitation_received',
      title: 'Lời mời thi đấu mới 🏇',
      message: 'Bạn nhận được một lời mời tham gia cuộc đua từ Chủ ngựa.',
      refModel: 'JockeyInvitation',
      refId: invitation._id,
    });

    // 4. Query lại để lấy đủ thông tin (populate) cho DTO
    const populatedInvitation = await JockeyInvitation.findById(invitation._id)
      .populate('horseId', 'name')
      .populate('raceId', 'name scheduledAt status')
      .populate('horseOwnerId', 'fullName')
      .lean();

    if (!populatedInvitation) {
      throw new HttpError(500, 'Lỗi hệ thống khi tạo lời mời');
    }

    // 5. Trả về DTO chuẩn mực
    return toInvitationDto(populatedInvitation);
  }
}