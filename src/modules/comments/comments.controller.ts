import type { Request, Response } from 'express';
import { getAuthUser } from '../../utils/auth';
import { idParamSchema, paginationSchema } from '../../utils/commonSchemas';
import { createCommentSchema } from './comments.schemas';
import * as commentsService from './comments.service';

/** GET /api/posts/:id/comments */
export async function listForPost(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  res.status(200).json(await commentsService.listComments(id, page, limit));
}

/** POST /api/posts/:id/comments */
export async function create(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createCommentSchema.parse(req.body);
  const comment = await commentsService.createComment(getAuthUser(req).id, id, input);
  res.status(201).json({ comment });
}

/** DELETE /api/comments/:id */
export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await commentsService.deleteComment(getAuthUser(req), id);
  res.status(204).end();
}
