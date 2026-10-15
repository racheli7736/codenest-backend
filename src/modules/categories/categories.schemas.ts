import { z } from 'zod';

const descriptionSchema = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
  description: descriptionSchema,
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Send at least one field to update',
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
