import 'dotenv/config';
import { z } from 'zod';

/** Example value from .env.example — must never be used in production. */
const EXAMPLE_SECRET = 'change-me-to-a-long-random-string-of-at-least-32-characters';

/** Empty strings (common in cloud dashboards) count as "not set". */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalUrl = optionalText.pipe(z.url().optional());

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

  // ---- Image storage (Cloudflare R2, S3-compatible) ----
  /** "r2" in every real environment. "memory" keeps files in RAM — tests / local experiments only. */
  STORAGE_DRIVER: z.enum(['r2', 'memory']).default('r2'),
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET: optionalText,
  /** Optional endpoint override (e.g. EU jurisdiction endpoint, or a local S3 server for tests). */
  R2_ENDPOINT: optionalUrl,
  /** Optional public bucket URL / custom domain. When set, images are served from it instead of signed URLs. */
  R2_PUBLIC_BASE_URL: optionalUrl,
  /** How long a signed image URL stays valid (only used with IMAGE_DELIVERY=redirect). */
  IMAGE_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(3600),
  /**
   * How GET /api/images/:id serves files stored in R2:
   *  - "proxy" (default): the API streams the file itself, so the image URL never changes
   *    (friendly to caches and content filters that approve images per URL).
   *  - "redirect": 302 to a short-lived signed R2 URL (less load on the API, but the URL changes).
   */
  IMAGE_DELIVERY: z.enum(['proxy', 'redirect']).default('proxy'),
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
  if (parsed.data.NODE_ENV === 'production' && parsed.data.STORAGE_DRIVER === 'memory') {
    throw new Error('STORAGE_DRIVER=memory loses every image on restart and is not allowed in production.');
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

/** R2 settings, or null when the required ones are missing (uploads then answer 503). */
export const r2Config = (() => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = env;
  const endpoint = R2_ENDPOINT ?? (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  if (!endpoint || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    endpoint,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL?.replace(/\/$/, ''),
  };
})();
