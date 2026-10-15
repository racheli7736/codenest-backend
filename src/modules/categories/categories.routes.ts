import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as categoriesController from './categories.controller';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

categoriesRouter.get('/', categoriesController.list);
categoriesRouter.post('/', requireRole('ADMIN'), categoriesController.create);
categoriesRouter.patch('/:id', requireRole('ADMIN'), categoriesController.update);
categoriesRouter.delete('/:id', requireRole('ADMIN'), categoriesController.remove);
