import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { uploadImage } from '../../middleware/upload';
import * as commentsController from '../comments/comments.controller';
import * as postsController from './posts.controller';

export const postsRouter = Router();

// Every posts endpoint requires login
postsRouter.use(authenticate);

postsRouter.get('/', postsController.list);
postsRouter.post('/', postsController.create);
postsRouter.get('/:id', postsController.getOne);
postsRouter.patch('/:id', postsController.update);
postsRouter.delete('/:id', postsController.remove);

postsRouter.put('/:id/image', uploadImage, postsController.setImage);
postsRouter.delete('/:id/image', postsController.removeImage);

postsRouter.post('/:id/like', postsController.like);
postsRouter.delete('/:id/like', postsController.unlike);
postsRouter.post('/:id/save', postsController.save);
postsRouter.delete('/:id/save', postsController.unsave);

postsRouter.get('/:id/comments', commentsController.listForPost);
postsRouter.post('/:id/comments', commentsController.create);
