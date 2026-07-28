import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.model.js';
import type { UserRole } from '../types/shared.types.js';
import type { PenaltyStatusDto } from '../types/api.types.js';
import { toPenaltyStatusDto } from '../utils/penalty-status.util.js';
import { HttpError } from '../utils/http-error.js';
import { sendPasswordResetEmail } from './mail.service.js';
import { ensureJockeyLicenseNumber } from './jockey-license.service.js';

export interface AuthUserDto {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  penaltyStatus?: PenaltyStatusDto;
  licenseNumber?: string;
  licenseExpiry?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUserDto;
}

interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

function toUserDto(doc: IUser & { _id: mongoose.Types.ObjectId }): AuthUserDto {
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    fullName: doc.fullName,
    phone: doc.phone,
    avatarUrl: doc.avatarUrl,
    penaltyStatus: doc.role === 'jockey' ? toPenaltyStatusDto(doc.jockeyProfile?.penaltyStatus) : undefined,
    licenseNumber: doc.role === 'jockey' ? doc.jockeyProfile?.licenseNumber : undefined,
    licenseExpiry:
      doc.role === 'jockey' && doc.jockeyProfile?.licenseExpiry
        ? new Date(doc.jockeyProfile.licenseExpiry).toISOString()
        : null,
  };
}

function signToken(user: AuthUserDto): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
  };
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): void {
  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, 'Email không hợp lệ');
  }
}

export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, 'Mật khẩu phải có ít nhất 8 ký tự');
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized }).select('+passwordHash');
  if (!user) {
    throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
  }
  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
  }
  if (!user.isActive) {
    if (user.role === 'jockey' && user.jockeyProfile?.approvalStatus === 'pending') {
      throw new HttpError(403, 'Hồ sơ Jockey đang chờ quản trị viên xét duyệt');
    }
    if (user.role === 'jockey' && user.jockeyProfile?.approvalStatus === 'rejected') {
      const note = user.jockeyProfile.adminNote?.trim();
      throw new HttpError(403, note ? `Hồ sơ Jockey đã bị từ chối: ${note}` : 'Hồ sơ Jockey đã bị từ chối');
    }
    throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa');
  }
  const dto = toUserDto(user);
  return { token: signToken(dto), user: dto };
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface RegisterJockeyInput extends RegisterInput {
  applicationPdfUrl: string;
  applicationPdfName: string;
}

export interface JockeyApplicationResponse {
  message: string;
  approvalRequired: true;
  applicationStatus: 'pending';
}

export async function registerSpectator(input: RegisterInput): Promise<AuthResponse> {
  validateEmail(input.email);
  validatePassword(input.password);
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new HttpError(400, 'Họ tên là bắt buộc');
  }

  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, 'Email đã được sử dụng');
  }

  const user = await User.create({
    email,
    passwordHash: input.password,
    role: 'spectator',
    fullName,
    phone: input.phone?.trim() || undefined,
  });

  const dto = toUserDto(user);
  return { token: signToken(dto), user: dto };
}

export async function registerJockeyApplication(
  input: RegisterJockeyInput,
): Promise<JockeyApplicationResponse> {
  validateEmail(input.email);
  validatePassword(input.password);
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new HttpError(400, 'Họ tên là bắt buộc');
  }
  if (!input.applicationPdfUrl || !input.applicationPdfName) {
    throw new HttpError(400, 'Hồ sơ PDF của Jockey là bắt buộc');
  }

  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    const canReapply =
      existing.role === 'jockey' &&
      !existing.isActive &&
      existing.jockeyProfile?.approvalStatus === 'rejected';

    if (!canReapply) {
      if (existing.role === 'jockey' && existing.jockeyProfile?.approvalStatus === 'pending') {
        throw new HttpError(409, 'Hồ sơ Jockey của email này đang chờ xét duyệt');
      }
      throw new HttpError(409, 'Email đã được sử dụng');
    }

    existing.passwordHash = input.password;
    existing.fullName = fullName;
    existing.phone = input.phone?.trim() || undefined;
    existing.isActive = false;
    existing.jockeyProfile = {
      licenseNumber: existing.jockeyProfile?.licenseNumber,
      approvalStatus: 'pending',
      applicationPdfUrl: input.applicationPdfUrl,
      applicationPdfName: input.applicationPdfName,
      appliedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      adminNote: null,
      isSuspended: false,
      penaltyStatus: {
        isBanned: false,
        bannedUntil: null,
        currentViolationId: null,
        reason: null,
      },
    };
    ensureJockeyLicenseNumber(existing);
    await existing.save();
  } else {
    const user = new User({
      email,
      passwordHash: input.password,
      role: 'jockey',
      fullName,
      phone: input.phone?.trim() || undefined,
      isActive: false,
      jockeyProfile: {
        approvalStatus: 'pending',
        applicationPdfUrl: input.applicationPdfUrl,
        applicationPdfName: input.applicationPdfName,
        appliedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        adminNote: null,
        isSuspended: false,
        penaltyStatus: {
          isBanned: false,
          bannedUntil: null,
          currentViolationId: null,
          reason: null,
        },
      },
    });
    ensureJockeyLicenseNumber(user);
    await user.save();
  }

  return {
    message: 'Đã gửi hồ sơ Jockey. Bạn có thể đăng nhập sau khi quản trị viên phê duyệt.',
    approvalRequired: true,
    applicationStatus: 'pending',
  };
}

export async function getMe(userId: string): Promise<AuthUserDto> {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, 'Token không hợp lệ');
  }
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new HttpError(401, 'Token không hợp lệ');
  }
  return toUserDto(user);
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUserDto> {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, 'Token không hợp lệ');
  }
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new HttpError(401, 'Token không hợp lệ');
  }

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim();
    if (!fullName) {
      throw new HttpError(400, 'Họ tên là bắt buộc');
    }
    user.fullName = fullName;
  }

  if (input.phone !== undefined) {
    user.phone = input.phone.trim() || undefined;
  }

  await user.save();
  return toUserDto(user);
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, 'Token không hợp lệ');
  }
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new HttpError(401, 'Token không hợp lệ');
  }
  const valid = await user.comparePassword(oldPassword);
  if (!valid) {
    throw new HttpError(401, 'Mật khẩu cũ không đúng');
  }
  validatePassword(newPassword);
  user.passwordHash = newPassword;
  await user.save();
  return { message: 'Đổi mật khẩu thành công' };
}

function hashPasswordResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildPasswordResetUrl(token: string): string {
  const url = new URL(env.passwordResetUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function requestPasswordReset(emailInput: string): Promise<{ message: string }> {
  validateEmail(emailInput);
  const email = emailInput.trim().toLowerCase();
  const publicMessage = 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu.';
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user || !user.isActive) {
    return { message: publicMessage };
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashPasswordResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000);
  await user.save();

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    resetUrl: buildPasswordResetUrl(token),
    expiresMinutes: env.passwordResetExpiresMinutes,
  });

  return { message: publicMessage };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  if (!token || token.length < 32) {
    throw new HttpError(400, 'Link đặt lại mật khẩu không hợp lệ');
  }
  validatePassword(newPassword);

  const tokenHash = hashPasswordResetToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
    isActive: true,
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    throw new HttpError(400, 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  user.passwordHash = newPassword;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  return { message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    if (!decoded.sub || !decoded.role || !decoded.email) {
      throw new HttpError(401, 'Token không hợp lệ');
    }
    return decoded;
  } catch {
    throw new HttpError(401, 'Token không hợp lệ');
  }
}
