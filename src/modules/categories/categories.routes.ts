import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as categoriesController from './categories.controller';

export const categoriesRouter = Router();

// Public: needed for the post filters, also for guests
categoriesRouter.get('/', categoriesController.list);

categoriesRouter.post('/', authenticate, requireRole('ADMIN'), categoriesController.create);
categoriesRouter.patch('/:id', authenticate, requireRole('ADMIN'), categoriesController.update);
categoriesRouter.delete('/:id', authenticate, requireRole('ADMIN'), categoriesController.remove);
