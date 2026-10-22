import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { uploadImage } from '../../middleware/upload';
import * as commentsController from '../comments/comments.controller';
import * as postsController from './posts.controller';

export const postsRouter = Router();

// Reading is open to guests (optionalAuthenticate); everything that changes data requires login.
postsRouter.get('/', optionalAuthenticate, postsController.list);
postsRouter.get('/:id', optionalAuthenticate, postsController.getOne);
postsRouter.get('/:id/comments', optionalAuthenticate, commentsController.listForPost);

postsRouter.post('/', authenticate, postsController.create);
postsRouter.patch('/:id', authenticate, postsController.update);
postsRouter.delete('/:id', authenticate, postsController.remove);

postsRouter.put('/:id/image', authenticate, uploadImage, postsController.setImage);
postsRouter.delete('/:id/image', authenticate, postsController.removeImage);

postsRouter.post('/:id/like', authenticate, postsController.like);
postsRouter.delete('/:id/like', authenticate, postsController.unlike);
postsRouter.post('/:id/save', authenticate, postsController.save);
postsRouter.delete('/:id/save', authenticate, postsController.unsave);

postsRouter.post('/:id/comments', authenticate, commentsController.create);
