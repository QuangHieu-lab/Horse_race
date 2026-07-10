import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as adminRegistrationService from '../services/admin-registration.service.js';
import * as adminService from '../services/admin.service.js';
import * as resultService from '../services/result.service.js';
import { HttpError } from '../utils/http-error.js';

export class AdminController {
  listUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await adminService.listUsers();
    res.json({ users });
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.createUser(req.body as adminService.CreateAdminUserInput);
    res.status(201).json({ user });
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.updateUser(
      req.user!.id,
      req.params.id as string,
      req.body as adminService.UpdateAdminUserInput,
    );
    res.json({ user });
  });

  listRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
    const registrations = await adminRegistrationService.listRegistrations(status);
    res.json({ registrations });
  });

  updateRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { status, adminNote } = req.body as {
      status?: 'approved' | 'rejected';
      adminNote?: string;
    };
    if (!status || !['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'status phải là approved hoặc rejected');
    }
    const registration = await adminRegistrationService.updateRegistrationStatus(
      req.user!.id,
      req.params.id as string,
      status,
      adminNote,
    );
    res.json({ registration });
  });

  publishResult = asyncHandler(async (req: Request, res: Response) => {
    await resultService.publishRaceResult(req.params.id as string, req.user!.id);
    res.json({ ok: true });
  });

  listPublishQueue = asyncHandler(async (_req: Request, res: Response) => {
    const queue = await resultService.listPublishQueue();
    res.json({ queue });
  });
}
