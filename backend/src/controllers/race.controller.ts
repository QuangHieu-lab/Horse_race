import type { Request, Response } from 'express';
import { Tournament } from '../models/Tournament.model.js';
import { Race } from '../models/Race.model.js';
import { ApiError } from '../utils/api-error.js';

export async function listTournaments(req: Request, res: Response) {
  const filter =
    req.userRole === 'admin'
      ? {}
      : { status: { $in: ['published', 'ongoing', 'completed'] } };
  const items = await Tournament.find(filter).sort({ startDate: -1 });
  res.json({ success: true, data: items });
}

export async function getTournament(req: Request, res: Response) {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw ApiError.notFound('Tournament not found');
  res.json({ success: true, data: t });
}

export async function createTournament(req: Request, res: Response) {
  const body = req.body ?? {};
  const t = await Tournament.create({
    ...body,
    createdBy: req.userId,
  });
  res.status(201).json({ success: true, data: t });
}

export async function updateTournament(req: Request, res: Response) {
  const t = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!t) throw ApiError.notFound('Tournament not found');
  res.json({ success: true, data: t });
}

export async function listRaces(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.tournamentId) filter.tournamentId = req.query.tournamentId;
  if (req.query.status) filter.status = req.query.status;

  if (req.userRole === 'horse_owner') {
    filter['participants.ownerId'] = req.userId;
  } else if (req.userRole === 'jockey') {
    filter['participants.jockeyId'] = req.userId;
  } else if (req.userRole === 'referee') {
    filter.refereeId = req.userId;
  }

  const items = await Race.find(filter).sort({ scheduledAt: 1 });
  res.json({ success: true, data: items });
}

export async function getRace(req: Request, res: Response) {
  const race = await Race.findById(req.params.id);
  if (!race) throw ApiError.notFound('Race not found');
  res.json({ success: true, data: race });
}

export async function createRace(req: Request, res: Response) {
  const race = await Race.create({
    ...req.body,
    tournamentId: req.params.tournamentId,
  });
  res.status(201).json({ success: true, data: race });
}

export async function updateRace(req: Request, res: Response) {
  const race = await Race.findById(req.params.id);
  if (!race) throw ApiError.notFound('Race not found');
  Object.assign(race, req.body);
  await race.save();
  res.json({ success: true, data: race });
}

export async function updateRaceStatus(req: Request, res: Response) {
  const { status } = req.body ?? {};
  if (!status) throw ApiError.badRequest('status required');

  const race = await Race.findById(req.params.id);
  if (!race) throw ApiError.notFound('Race not found');

  if (req.userRole === 'referee' && race.refereeId?.toString() !== req.userId) {
    throw ApiError.forbidden('Not assigned referee');
  }

  race.status = status;
  await race.save();
  res.json({ success: true, data: race });
}

export async function confirmParticipant(req: Request, res: Response) {
  const { horseId } = req.body ?? {};
  if (!horseId) throw ApiError.badRequest('horseId required');

  const race = await Race.findById(req.params.id);
  if (!race) throw ApiError.notFound('Race not found');

  const p = race.participants.find(
    (x) => x.horseId.toString() === horseId && x.ownerId.toString() === req.userId,
  );
  if (!p) throw ApiError.notFound('Participant not found for your horse');

  p.confirmedAt = new Date();
  await race.save();
  res.json({ success: true, data: race });
}
