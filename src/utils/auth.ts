import type { Request } from 'express';
import { unauthorized } from './httpError';

/** Returns the logged-in user (from the JWT). Use only on routes behind `authenticate`. */
export function getAuthUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}
