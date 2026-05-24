import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.model.js';
import type { UserRole } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';

export interface AuthUserDto {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
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
  if (!user.isActive) {
    throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa');
  }
  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new HttpError(401, 'Email hoặc mật khẩu không đúng');
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
