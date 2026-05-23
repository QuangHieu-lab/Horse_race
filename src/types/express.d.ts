import type { UserRole } from './shared.types.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      userEmail?: string;
    }
  }
}

export {};
