import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { uploadImage } from '../../middleware/upload';
import * as usersController from './users.controller';

export const usersRouter = Router();

// "/me" routes must come before "/:id" routes. They are always private.
usersRouter.get('/me/dashboard', authenticate, usersController.dashboard);
usersRouter.patch('/me', authenticate, usersController.updateMe);
usersRouter.put('/me/avatar', authenticate, uploadImage, usersController.setAvatar);
usersRouter.delete('/me/avatar', authenticate, usersController.removeAvatar);
usersRouter.get('/me/saved-posts', authenticate, usersController.savedPosts);

usersRouter.get('/', authenticate, requireRole('ADMIN'), usersController.list);

// Public profiles: guests can view them (email stays hidden)
usersRouter.get('/:id', optionalAuthenticate, usersController.getProfile);
usersRouter.get('/:id/followers', optionalAuthenticate, usersController.followers);
usersRouter.get('/:id/following', optionalAuthenticate, usersController.following);

usersRouter.post('/:id/follow', authenticate, usersController.follow);
usersRouter.delete('/:id/follow', authenticate, usersController.unfollow);
