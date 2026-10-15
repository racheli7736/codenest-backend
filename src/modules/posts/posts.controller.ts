import type { Request, Response } from 'express';
import { getAuthUser } from '../../utils/auth';
import { idParamSchema } from '../../utils/commonSchemas';
import { createPostSchema, listPostsQuerySchema, updatePostSchema } from './posts.schemas';
import * as postsService from './posts.service';

export async function list(req: Request, res: Response) {
  const query = listPostsQuerySchema.parse(req.query);
  res.status(200).json(await postsService.listPosts(getAuthUser(req), query));
}

export async function getOne(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json({ post: await postsService.getPost(getAuthUser(req), id) });
}

export async function create(req: Request, res: Response) {
  const input = createPostSchema.parse(req.body);
  res.status(201).json({ post: await postsService.createPost(getAuthUser(req), input) });
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updatePostSchema.parse(req.body);
  res.status(200).json({ post: await postsService.updatePost(getAuthUser(req), id, input) });
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await postsService.deletePost(getAuthUser(req), id);
  res.status(204).end();
}

export async function setImage(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json({ post: await postsService.setPostImage(getAuthUser(req), id, req.file) });
}

export async function removeImage(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await postsService.removePostImage(getAuthUser(req), id);
  res.status(204).end();
}

export async function like(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await postsService.likePost(getAuthUser(req), id));
}

export async function unlike(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await postsService.unlikePost(getAuthUser(req), id));
}

export async function save(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await postsService.savePost(getAuthUser(req), id));
}

export async function unsave(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await postsService.unsavePost(getAuthUser(req), id));
}
