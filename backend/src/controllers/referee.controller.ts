import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as refereeService from '../services/referee.service.js';
import * as resultService from '../services/result.service.js';
import { HttpError } from '../utils/http-error.js';

export class RefereeController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const dashboard = await refereeService.getRefereeDashboard(req.user!.id);
    res.json({ dashboard });
  });

  listRaces = asyncHandler(async (req: Request, res: Response) => {
    const races = await refereeService.listRefereeRaces(req.user!.id);
    res.json({ races });
  });

  listChecks = asyncHandler(async (req: Request, res: Response) => {
    const checks = await refereeService.listRefereeChecks(
      req.user!.id,
      req.params.id as string,
    );
    res.json({ checks });
  });

  toggleCheck = asyncHandler(async (req: Request, res: Response) => {
    const { horseId, field } = req.body as {
      horseId?: string;
      field?: 'vetApprovedAt' | 'confirmedAt';
    };
    if (!horseId || !field || !['vetApprovedAt', 'confirmedAt'].includes(field)) {
      throw new HttpError(400, 'horseId và field hợp lệ là bắt buộc');
    }
    await refereeService.toggleParticipantCheck(
      req.user!.id,
      req.params.id as string,
      horseId,
      field,
    );
    res.json({ ok: true });
  });

  upsertResult = asyncHandler(async (req: Request, res: Response) => {
    const rankings =
      (req.body as { rankings?: unknown }).rankings ??
      (await refereeService.buildResultFromRace(req.params.id as string, req.user!.id));
    const result = await resultService.upsertRaceResult(req.params.id as string, {
      rankings: rankings as Parameters<typeof resultService.upsertRaceResult>[1]['rankings'],
    });
    res.json({ result });
  });

  confirmResult = asyncHandler(async (req: Request, res: Response) => {
    await resultService.confirmRaceResult(req.params.id as string, req.user!.id);
    res.json({ ok: true });
  });

  getResult = asyncHandler(async (req: Request, res: Response) => {
    const result = await resultService.getResultByRaceId(req.params.id as string);
    res.json({ result });
  });
}
