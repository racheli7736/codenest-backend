import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

/** Slows down password guessing: max 20 login/register attempts per IP every 15 minutes. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again in a few minutes' },
    });
  },
});
