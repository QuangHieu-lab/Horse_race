import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as jockeyService from '../services/jockey.service.js';
import type { InvitationStatus } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';

export class JockeyController {
  dashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await jockeyService.getJockeyDashboard(req.user!.id);
    res.json(data);
  });

  listInvitations = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as InvitationStatus | undefined;
    const validStatuses: InvitationStatus[] = ['pending', 'accepted', 'declined'];
    if (status && !validStatuses.includes(status)) {
      throw new HttpError(400, 'Trạng thái lời mời không hợp lệ');
    }
    const invitations = await jockeyService.listInvitations(req.user!.id, status);
    res.json({ invitations });
  });

  respondInvitation = asyncHandler(async (req: Request, res: Response) => {
    const { action } = req.body as { action?: string };
    if (action !== 'accept' && action !== 'decline') {
      throw new HttpError(400, 'action phải là accept hoặc decline');
    }
    const invitation = await jockeyService.respondToInvitation(
      req.user!.id,
      req.params.id as string,
      action,
    );
    res.json({ invitation });
  });

  listRaces = asyncHandler(async (req: Request, res: Response) => {
    const races = await jockeyService.listJockeyRaces(req.user!.id);
    res.json({ races });
  });

  getRaceById = asyncHandler(async (req: Request, res: Response) => {
    const race = await jockeyService.getJockeyRace(req.user!.id, req.params.id as string);
    res.json({ race });
  });
}
