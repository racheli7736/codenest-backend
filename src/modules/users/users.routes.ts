import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { uploadImage } from '../../middleware/upload';
import * as usersController from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

// "/me" routes must come before "/:id" routes
usersRouter.get('/me/dashboard', usersController.dashboard);
usersRouter.patch('/me', usersController.updateMe);
usersRouter.put('/me/avatar', uploadImage, usersController.setAvatar);
usersRouter.delete('/me/avatar', usersController.removeAvatar);
usersRouter.get('/me/saved-posts', usersController.savedPosts);

usersRouter.get('/', requireRole('ADMIN'), usersController.list);

usersRouter.get('/:id', usersController.getProfile);
usersRouter.get('/:id/followers', usersController.followers);
usersRouter.get('/:id/following', usersController.following);
usersRouter.post('/:id/follow', usersController.follow);
usersRouter.delete('/:id/follow', usersController.unfollow);
