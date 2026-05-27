import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../types/shared.types.js';
import { HttpError } from '../utils/http-error.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'Yêu cầu đăng nhập'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'Không có quyền truy cập'));
      return;
    }
    next();
  };
}
