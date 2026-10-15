import { z } from 'zod';
import { paginationSchema, searchSchema } from '../../utils/commonSchemas';

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50).optional(),
    bio: z
      .string()
      .trim()
      .max(300, 'Bio must be at most 300 characters')
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
  })
  .refine((data) => data.name !== undefined || data.bio !== undefined, {
    message: 'Send at least one field to update',
  });

export const listUsersQuerySchema = paginationSchema.extend({
  search: searchSchema,
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
