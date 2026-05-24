import type { UserRole } from './shared.types.js';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
