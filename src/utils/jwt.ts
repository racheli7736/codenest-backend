import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessTokenPayload {
  userId: number;
  role: Role;
}

export function signAccessToken(user: { id: number; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Throws a jsonwebtoken error (TokenExpiredError / JsonWebTokenError) if the token is bad. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !/^\d+$/.test(decoded.sub)) {
    throw new jwt.JsonWebTokenError('Malformed token payload');
  }
  return { userId: Number(decoded.sub), role: decoded.role as Role };
}
