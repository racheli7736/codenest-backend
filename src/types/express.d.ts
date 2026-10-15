import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware — the user identified by the JWT. */
      user?: { id: number; role: Role };
    }
  }
}

export {};
