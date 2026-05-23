import type { Request, Response } from 'express';
import { JockeyInvitation } from '../models/JockeyInvitation.model.js';
import { Horse } from '../models/Horse.model.js';
import { Notification } from '../models/Notification.model.js';
import { ApiError } from '../utils/api-error.js';
import type { InvitationStatus } from '../types/shared.types.js';

export async function createInvitation(req: Request, res: Response) {
  const { jockeyId, horseId, raceId, message } = req.body ?? {};
  if (!jockeyId || !horseId || !raceId) {
    throw ApiError.badRequest('jockeyId, horseId, raceId required');
  }

  const horse = await Horse.findById(horseId);
  if (!horse || horse.ownerId.toString() !== req.userId) {
    throw ApiError.forbidden('Horse not found or not yours');
  }

  const inv = await JockeyInvitation.create({
    horseOwnerId: req.userId,
    jockeyId,
    horseId,
    raceId,
    message,
    status: 'pending',
  });

  await Notification.create({
    userId: jockeyId,
    type: 'invitation_received',
    title: 'Lời mời điều khiển ngựa',
    message: message ?? `Bạn được mời điều khiển ${horse.name}.`,
    refModel: 'JockeyInvitation',
    refId: inv._id,
  });

  res.status(201).json({ success: true, data: inv });
}

export async function listInvitations(req: Request, res: Response) {
  const filter: Record<string, unknown> =
    req.userRole === 'jockey'
      ? { jockeyId: req.userId }
      : { horseOwnerId: req.userId };
  if (req.query.status) filter.status = req.query.status;

  const items = await JockeyInvitation.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
}

export async function respondInvitation(req: Request, res: Response) {
  const { status } = req.body ?? {};
  if (!['accepted', 'declined'].includes(status)) {
    throw ApiError.badRequest('status must be accepted or declined');
  }

  const inv = await JockeyInvitation.findById(req.params.id);
  if (!inv) throw ApiError.notFound('Invitation not found');
  if (inv.jockeyId.toString() !== req.userId) throw ApiError.forbidden('Not your invitation');
  if (inv.status !== 'pending') throw ApiError.conflict('Invitation already responded');

  inv.status = status as InvitationStatus;
  inv.respondedAt = new Date();
  await inv.save();

  const notifType = status === 'accepted' ? 'invitation_accepted' : 'invitation_declined';
  await Notification.create({
    userId: inv.horseOwnerId,
    type: notifType,
    title: status === 'accepted' ? 'Jockey đã chấp nhận' : 'Jockey từ chối',
    message: `Lời mời cuộc đua đã được ${status === 'accepted' ? 'chấp nhận' : 'từ chối'}.`,
    refModel: 'JockeyInvitation',
    refId: inv._id,
  });

  res.json({ success: true, data: inv });
}
