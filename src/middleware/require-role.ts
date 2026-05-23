import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../types/shared.types.js';
import { ApiError } from '../utils/api-error.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
