import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as commentsController from './comments.controller';

// Listing and creating comments live under /api/posts/:id/comments (see posts.routes.ts)
export const commentsRouter = Router();

commentsRouter.delete('/:id', authenticate, commentsController.remove);
