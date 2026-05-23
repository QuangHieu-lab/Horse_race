import type { Request, Response } from 'express';
import { RaceRegistration } from '../models/RaceRegistration.model.js';
import * as regService from '../services/registration.service.js';
import { ApiError } from '../utils/api-error.js';
import { paramId } from '../utils/params.js';
import type { RegistrationStatus } from '../types/shared.types.js';

export async function createRegistration(req: Request, res: Response) {
  const { horseId } = req.body ?? {};
  if (!horseId) throw ApiError.badRequest('horseId required');
  const reg = await regService.createRegistration(
    paramId(req, 'raceId'),
    req.userId!,
    horseId,
  );
  res.status(201).json({ success: true, data: reg });
}

export async function listRegistrations(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.raceId) filter.raceId = req.query.raceId;
  if (req.query.status) filter.status = req.query.status;
  if (req.userRole === 'horse_owner') filter.ownerId = req.userId;

  const items = await RaceRegistration.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
}

export async function reviewRegistration(req: Request, res: Response) {
  const { status, adminNote } = req.body ?? {};
  if (!['approved', 'rejected'].includes(status)) {
    throw ApiError.badRequest('status must be approved or rejected');
  }
  const reg = await regService.reviewRegistration(
    paramId(req, 'id'),
    req.userId!,
    status as RegistrationStatus,
    adminNote,
  );
  res.json({ success: true, data: reg });
}
