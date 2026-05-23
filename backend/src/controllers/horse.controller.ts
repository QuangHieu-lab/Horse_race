import type { Request, Response } from 'express';
import { Horse } from '../models/Horse.model.js';
import { ApiError } from '../utils/api-error.js';

export async function listHorses(req: Request, res: Response) {
  const filter =
    req.userRole === 'admin' ? {} : { ownerId: req.userId };
  const items = await Horse.find(filter).sort({ name: 1 });
  res.json({ success: true, data: items });
}

export async function createHorse(req: Request, res: Response) {
  const horse = await Horse.create({ ...req.body, ownerId: req.userId });
  res.status(201).json({ success: true, data: horse });
}

export async function updateHorse(req: Request, res: Response) {
  const horse = await Horse.findById(req.params.id);
  if (!horse) throw ApiError.notFound('Horse not found');
  if (req.userRole !== 'admin' && horse.ownerId.toString() !== req.userId) {
    throw ApiError.forbidden('Not your horse');
  }
  Object.assign(horse, req.body);
  await horse.save();
  res.json({ success: true, data: horse });
}
