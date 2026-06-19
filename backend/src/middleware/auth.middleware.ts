import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Yêu cầu đăng nhập'));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}
