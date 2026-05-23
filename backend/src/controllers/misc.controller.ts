import type { Request, Response } from 'express';
import { Notification } from '../models/Notification.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/api-error.js';

export async function listNotifications(req: Request, res: Response) {
  const items = await Notification.find({ userId: req.userId })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data: items });
}

export async function markRead(req: Request, res: Response) {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { isRead: true },
    { new: true },
  );
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: n });
}

export async function listUsers(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.role) filter.role = req.query.role;
  const items = await User.find(filter).select('-passwordHash').sort({ fullName: 1 });
  res.json({ success: true, data: items });
}

export async function updateUser(req: Request, res: Response) {
  const { role, isActive, fullName, phone } = req.body ?? {};
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  res.json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      isActive: user.isActive,
    },
  });
}
