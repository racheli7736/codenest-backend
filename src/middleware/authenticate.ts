import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { unauthorized } from '../utils/httpError';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Reads `Authorization: Bearer <token>` and loads the user from the database.
 * Returns null when there is no header at all; throws 401 when a token is present but bad.
 * The user is always taken from the token — never from ids sent by the client.
 */
async function resolveUser(req: Request) {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith('Bearer ')) {
    throw unauthorized('Authorization header must look like "Bearer <token>"', 'TOKEN_INVALID');
  }

  const token = header.slice('Bearer '.length).trim();
  let userId: number;
  try {
    userId = verifyAccessToken(token).userId;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Token has expired, please log in again', 'TOKEN_EXPIRED');
    }
    throw unauthorized('Token is invalid', 'TOKEN_INVALID');
  }

  // Load the user fresh from the database so a deleted user or a changed role takes effect immediately.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw unauthorized('Token is invalid', 'TOKEN_INVALID');
  return user;
}

/** Requires a valid Bearer token (401 otherwise). */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw unauthorized('Missing Bearer token in the Authorization header', 'TOKEN_MISSING');
  req.user = user;
  next();
};

/**
 * For public pages: guests (no Authorization header) are allowed and `req.user` stays undefined.
 * A token that IS sent must still be valid — an expired one answers 401 so the app can log the user out.
 */
export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (user) req.user = user;
  next();
};
