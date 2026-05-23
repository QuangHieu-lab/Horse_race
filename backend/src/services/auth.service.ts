import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import type { UserRole } from '../types/shared.types.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/api-error.js';

const PUBLIC_REGISTER_ROLES: UserRole[] = [
  'horse_owner',
  'jockey',
  'referee',
  'spectator',
];

export function toPublicUser(user: {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
}) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
  };
}

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  phone?: string;
}) {
  const role = input.role ?? 'spectator';
  if (role === 'admin') {
    throw ApiError.forbidden('Cannot self-register as admin');
  }
  if (!PUBLIC_REGISTER_ROLES.includes(role)) {
    throw ApiError.badRequest('Invalid role');
  }

  const exists = await User.findOne({ email: input.email.toLowerCase() });
  if (exists) throw ApiError.conflict('Email already registered');

  const user = await User.create({
    email: input.email,
    passwordHash: input.password,
    fullName: input.fullName,
    role,
    phone: input.phone,
  });

  const token = signToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  return { token, user: toPublicUser(user) };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  const token = signToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  return { token, user: toPublicUser(user) };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}
