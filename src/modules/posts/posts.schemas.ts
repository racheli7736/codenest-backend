import { z } from 'zod';
import { ProgrammingLanguage } from '@prisma/client';
import { paginationSchema, searchSchema } from '../../utils/commonSchemas';

export const languageSchema = z.enum(ProgrammingLanguage);

/** Empty strings from a form ("") are saved as null. Code is NOT trimmed — indentation matters. */
const codeSnippetSchema = z
  .string()
  .max(10000, 'Code snippet must be at most 10,000 characters')
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value?.trim() ? value : null));

const postFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  codeSnippet: codeSnippetSchema,
  language: languageSchema.nullable().optional(),
  categoryId: z.coerce.number().int().positive(),
};

export const createPostSchema = z.object(postFields);

export const updatePostSchema = z
  .object(postFields)
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Send at least one field to update',
  });

export const listPostsQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: z.coerce.number().int().positive().optional(),
  language: languageSchema.optional(),
  authorId: z.coerce.number().int().positive().optional(),
  feed: z.enum(['all', 'following']).default('all'),
  sort: z.enum(['newest', 'popular']).default('newest'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
