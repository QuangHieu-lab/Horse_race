import { User } from '../models/User.model.js';
import type { UserRole } from '../types/shared.types.js';

export interface AdminUserDto {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
  createdAt: string;
}

export async function listUsers(): Promise<AdminUserDto[]> {
  const users = await User.find()
    .select('email role fullName isActive createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    role: u.role,
    fullName: u.fullName,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  }));
}
