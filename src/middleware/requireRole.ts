import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { forbidden } from '../utils/httpError';
import { getAuthUser } from '../utils/auth';

/** Allows the request only if the logged-in user has one of the given roles (use after `authenticate`). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = getAuthUser(req);
    if (!roles.includes(user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(', ')}`);
    }
    next();
  };
}
