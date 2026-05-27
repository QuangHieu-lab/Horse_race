import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as jockeyService from '../services/jockey.service.js';
import type { InvitationStatus } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';

export const jockeyRouter = Router();

jockeyRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const data = await jockeyService.getJockeyDashboard(req.user!.id);
    res.json(data);
  }),
);

jockeyRouter.get(
  '/invitations',
  asyncHandler(async (req, res) => {
    const status = req.query.status as InvitationStatus | undefined;
    const validStatuses: InvitationStatus[] = ['pending', 'accepted', 'declined'];
    if (status && !validStatuses.includes(status)) {
      throw new HttpError(400, 'Trạng thái lời mời không hợp lệ');
    }
    const invitations = await jockeyService.listInvitations(req.user!.id, status);
    res.json({ invitations });
  }),
);

jockeyRouter.patch(
  '/invitations/:id',
  asyncHandler(async (req, res) => {
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
  }),
);

jockeyRouter.get(
  '/races',
  asyncHandler(async (req, res) => {
    const races = await jockeyService.listJockeyRaces(req.user!.id);
    res.json({ races });
  }),
);

jockeyRouter.get(
  '/races/:id',
  asyncHandler(async (req, res) => {
    const race = await jockeyService.getJockeyRace(req.user!.id, req.params.id as string);
    res.json({ race });
  }),
);
