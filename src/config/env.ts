import 'dotenv/config';
import { z } from 'zod';

/** Example value from .env.example — must never be used in production. */
const EXAMPLE_SECRET = 'change-me-to-a-long-random-string-of-at-least-32-characters';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must start with postgresql://'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, 'JWT_EXPIRES_IN must look like 15m, 24h or 7d')
    .default('24h'),
  /** Comma-separated list of allowed origins, or * for any origin. */
  CORS_ORIGIN: z.string().default('*'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}\nSee .env.example for help.`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === EXAMPLE_SECRET) {
    throw new Error('JWT_SECRET is still the example value. Set a real random secret in production.');
  }
  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins: '*' | string[] =
  env.CORS_ORIGIN.trim() === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);
