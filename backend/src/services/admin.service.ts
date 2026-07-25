import { User } from '../models/User.model.js';
import type { UserRole } from '../types/shared.types.js';
import { USER_ROLES } from '../types/shared.types.js';
import { validateEmail, validatePassword } from './auth.service.js';
import { HttpError } from '../utils/http-error.js';
import { Horse } from '../models/Horse.model.js';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Notification } from '../models/Notification.model.js';
import { PaymentTransaction } from '../models/PaymentTransaction.model.js';
import { Race } from '../models/Race.model.js';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import { Result } from '../models/Result.model.js';
import { SpectatorProfile } from '../models/SpectatorProfile.model.js';

export interface AdminUserDto {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  certificationId?: string | null;
  createdAt: string;
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  licenseNumber?: string;
  licenseExpiry?: string | null;
  certificationId?: string;
}

export interface UpdateAdminUserInput {
  fullName?: string;
  phone?: string | null;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  certificationId?: string | null;
}

function toAdminUserDto(user: {
  _id: { toString(): string };
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
  jockeyProfile?: { licenseNumber?: string | null; licenseExpiry?: Date | null } | null;
  refereeProfile?: { certificationId?: string | null } | null;
  createdAt: Date;
}): AdminUserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone ?? null,
    isActive: user.isActive,
    licenseNumber: user.jockeyProfile?.licenseNumber ?? null,
    licenseExpiry: user.jockeyProfile?.licenseExpiry?.toISOString() ?? null,
    certificationId: user.refereeProfile?.certificationId ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function assertRole(role: string): asserts role is UserRole {
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new HttpError(400, 'Role không hợp lệ');
  }
}

function applyRoleProfile(user: {
  role: UserRole;
  jockeyProfile?: unknown;
  refereeProfile?: unknown;
}, input: {
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  certificationId?: string | null;
} = {}) {
  if (user.role === 'jockey') {
    user.jockeyProfile = {
      licenseNumber: input.licenseNumber?.trim() || undefined,
      licenseExpiry: input.licenseExpiry ? new Date(input.licenseExpiry) : null,
      isSuspended: false,
      penaltyStatus: {
        isBanned: false,
        bannedUntil: null,
        currentViolationId: null,
        reason: null,
      },
    };
    user.refereeProfile = undefined;
    return;
  }

  if (user.role === 'referee') {
    user.refereeProfile = {
      certificationId: input.certificationId?.trim() || undefined,
    };
    user.jockeyProfile = undefined;
    return;
  }

  user.jockeyProfile = undefined;
  user.refereeProfile = undefined;
}

export async function listUsers(): Promise<AdminUserDto[]> {
  const users = await User.find()
    .select('email role fullName phone isActive jockeyProfile.licenseNumber jockeyProfile.licenseExpiry refereeProfile.certificationId createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return users.map(toAdminUserDto);
}

export async function createUser(input: CreateAdminUserInput): Promise<AdminUserDto> {
  validateEmail(input.email);
  validatePassword(input.password);
  assertRole(input.role);

  const fullName = input.fullName.trim();
  if (!fullName) throw new HttpError(400, 'Họ tên là bắt buộc');
  if (input.role === 'admin') throw new HttpError(400, 'Không tạo admin mới từ màn hình này');

  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new HttpError(409, 'Email đã được sử dụng');

  const user = new User({
    email,
    passwordHash: input.password,
    role: input.role,
    fullName,
    phone: input.phone?.trim() || undefined,
    isActive: true,
  });
  applyRoleProfile(user, input);
  await user.save();

  return toAdminUserDto(user);
}

export async function updateUser(
  actorId: string,
  userId: string,
  input: UpdateAdminUserInput,
): Promise<AdminUserDto> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản');

  const isSelf = actorId === user._id.toString();
  if (input.isActive === false && isSelf) {
    throw new HttpError(400, 'Không thể tự vô hiệu hóa tài khoản admin đang đăng nhập');
  }
  if (input.role && isSelf && input.role !== user.role) {
    throw new HttpError(400, 'Không thể tự đổi role của tài khoản đang đăng nhập');
  }

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim();
    if (!fullName) throw new HttpError(400, 'Họ tên là bắt buộc');
    user.fullName = fullName;
  }
  if (input.phone !== undefined) user.phone = input.phone?.trim() || undefined;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  if (input.password) {
    validatePassword(input.password);
    user.passwordHash = input.password;
  }
  if (input.role) {
    assertRole(input.role);
    if (input.role === 'admin' && user.role !== 'admin') {
      throw new HttpError(400, 'Không nâng quyền admin từ màn hình này');
    }
    user.role = input.role;
    applyRoleProfile(user, input);
  } else if (
    input.licenseNumber !== undefined ||
    input.licenseExpiry !== undefined ||
    input.certificationId !== undefined
  ) {
    applyRoleProfile(user, input);
  }

  await user.save();
  return toAdminUserDto(user);
}

export async function deleteUser(actorId: string, userId: string): Promise<void> {
  if (actorId === userId) {
    throw new HttpError(400, 'Không thể tự xóa tài khoản admin đang đăng nhập');
  }

  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản');
  if (user.role === 'admin') {
    throw new HttpError(400, 'Không xóa tài khoản admin từ màn hình này');
  }

  const objectId = user._id;
  const [
    horseCount,
    registrationCount,
    invitationCount,
    raceCount,
    resultCount,
    paymentCount,
    walletCount,
    notificationCount,
  ] = await Promise.all([
    Horse.countDocuments({
      $or: [{ ownerId: objectId }, { currentJockeyId: objectId }],
    }),
    RaceRegistration.countDocuments({
      $or: [{ ownerId: objectId }, { jockeyId: objectId }, { processedBy: objectId }],
    }),
    JockeyInvitation.countDocuments({
      $or: [{ horseOwnerId: objectId }, { jockeyId: objectId }],
    }),
    Race.countDocuments({
      $or: [
        { refereeId: objectId },
        { 'participants.ownerId': objectId },
        { 'participants.jockeyId': objectId },
      ],
    }),
    Result.countDocuments({
      $or: [
        { confirmedBy: objectId },
        { publishedBy: objectId },
        { 'rankings.ownerId': objectId },
        { 'rankings.jockeyId': objectId },
        { 'violations.ownerId': objectId },
        { 'violations.jockeyId': objectId },
      ],
    }),
    PaymentTransaction.countDocuments({ userId: objectId }),
    SpectatorProfile.countDocuments({
      userId: objectId,
      $or: [
        { currentBalance: { $ne: 0 } },
        { totalPointsEarned: { $ne: 0 } },
        { totalPointsSpent: { $ne: 0 } },
        { ledger: { $exists: true, $not: { $size: 0 } } },
      ],
    }),
    Notification.countDocuments({ userId: objectId }),
  ]);

  const hasLinkedData = [
    horseCount,
    registrationCount,
    invitationCount,
    raceCount,
    resultCount,
    paymentCount,
    walletCount,
    notificationCount,
  ].some((count) => count > 0);

  if (hasLinkedData) {
    throw new HttpError(
      409,
      'Tài khoản đã có dữ liệu liên kết trong hệ thống. Hãy vô hiệu hóa tài khoản thay vì xóa để giữ lịch sử thi đấu và giao dịch.',
    );
  }

  await Promise.all([
    SpectatorProfile.deleteMany({ userId: objectId }),
    User.findByIdAndDelete(objectId),
  ]);
}
