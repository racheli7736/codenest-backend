import type { Request, Response } from 'express';
import { getAuthUser } from '../../utils/auth';
import { idParamSchema, paginationSchema } from '../../utils/commonSchemas';
import { listUsersQuerySchema, updateMeSchema } from './users.schemas';
import * as usersService from './users.service';

export async function dashboard(req: Request, res: Response) {
  res.status(200).json(await usersService.getDashboard(getAuthUser(req).id));
}

export async function updateMe(req: Request, res: Response) {
  const input = updateMeSchema.parse(req.body);
  res.status(200).json({ user: await usersService.updateMe(getAuthUser(req).id, input) });
}

export async function setAvatar(req: Request, res: Response) {
  res.status(200).json({ user: await usersService.setAvatar(getAuthUser(req).id, req.file) });
}

export async function removeAvatar(req: Request, res: Response) {
  await usersService.removeAvatar(getAuthUser(req).id);
  res.status(204).end();
}

export async function savedPosts(req: Request, res: Response) {
  const { page, limit } = paginationSchema.parse(req.query);
  res.status(200).json(await usersService.listSavedPosts(getAuthUser(req).id, page, limit));
}

export async function list(req: Request, res: Response) {
  const query = listUsersQuerySchema.parse(req.query);
  res.status(200).json(await usersService.listUsers(query));
}

export async function getProfile(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json({ user: await usersService.getProfile(req.user ?? null, id) });
}

export async function followers(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  res.status(200).json(await usersService.listFollowers(id, page, limit));
}

export async function following(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  res.status(200).json(await usersService.listFollowing(id, page, limit));
}

export async function follow(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await usersService.follow(getAuthUser(req).id, id);
  res.status(204).end();
}

export async function unfollow(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await usersService.unfollow(getAuthUser(req).id, id);
  res.status(204).end();
}
