import { z } from 'zod';

/** `:id` in the URL — must be a positive whole number. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** `?page=1&limit=10` — limit is capped at 50 to keep responses fast. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Optional free-text search, empty string is treated as "no search". */
export const searchSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => (value ? value : undefined));
