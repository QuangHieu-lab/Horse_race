import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/api-error.js';

export async function register(req: Request, res: Response) {
  const { email, password, fullName, role, phone } = req.body ?? {};
  if (!email || !password || !fullName) {
    throw ApiError.badRequest('email, password, fullName are required');
  }
  const data = await authService.register({ email, password, fullName, role, phone });
  res.status(201).json({ success: true, data });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw ApiError.badRequest('email and password required');
  const data = await authService.login(email, password);
  res.json({ success: true, data });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.userId!);
  res.json({ success: true, data: user });
}
