import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(1000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
