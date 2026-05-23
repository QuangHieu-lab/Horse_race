import type { Request, Response } from 'express';
import { Result } from '../models/Result.model.js';
import * as resultService from '../services/result.service.js';
import { ApiError } from '../utils/api-error.js';
import { paramId } from '../utils/params.js';

export async function listResults(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.tournamentId) filter.tournamentId = req.query.tournamentId;
  if (req.userRole !== 'admin' && req.userRole !== 'referee') {
    filter.publishedAt = { $ne: null };
  }
  const items = await Result.find(filter).sort({ updatedAt: -1 });
  res.json({ success: true, data: items });
}

export async function getResultByRace(req: Request, res: Response) {
  const result = await Result.findOne({ raceId: paramId(req, 'raceId') });
  if (!result) throw ApiError.notFound('Result not found');
  if (!result.publishedAt && req.userRole !== 'admin' && req.userRole !== 'referee') {
    throw ApiError.notFound('Result not published yet');
  }
  res.json({ success: true, data: result });
}

export async function upsertResult(req: Request, res: Response) {
  const result = await resultService.upsertResult(
    paramId(req, 'raceId'),
    req.userId!,
    req.body ?? {},
  );
  res.json({ success: true, data: result });
}

export async function confirmResult(req: Request, res: Response) {
  const result = await resultService.confirmResult(paramId(req, 'raceId'), req.userId!);
  res.json({ success: true, data: result });
}

export async function publishResult(req: Request, res: Response) {
  const data = await resultService.publishResult(paramId(req, 'raceId'), req.userId!);
  res.json({ success: true, data });
}
