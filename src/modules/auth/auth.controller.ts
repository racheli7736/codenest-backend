import type { Request, Response } from 'express';
import { getAuthUser } from '../../utils/auth';
import { loginSchema, registerSchema } from './auth.schemas';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  res.status(201).json(await authService.register(input));
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  res.status(200).json(await authService.login(input));
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(getAuthUser(req).id);
  res.status(200).json({ user });
}
