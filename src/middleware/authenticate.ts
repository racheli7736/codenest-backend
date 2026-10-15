import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { unauthorized } from '../utils/httpError';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Requires a valid `Authorization: Bearer <token>` header.
 * The user is always taken from the token — never from ids sent by the client.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Missing Bearer token in the Authorization header', 'TOKEN_MISSING');
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

  req.user = user;
  next();
};
