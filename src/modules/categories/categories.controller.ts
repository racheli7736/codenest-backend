import type { Request, Response } from 'express';
import { idParamSchema } from '../../utils/commonSchemas';
import { createCategorySchema, updateCategorySchema } from './categories.schemas';
import * as categoriesService from './categories.service';

export async function list(_req: Request, res: Response) {
  res.status(200).json({ items: await categoriesService.listCategories() });
}

export async function create(req: Request, res: Response) {
  const input = createCategorySchema.parse(req.body);
  res.status(201).json({ category: await categoriesService.createCategory(input) });
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateCategorySchema.parse(req.body);
  res.status(200).json({ category: await categoriesService.updateCategory(id, input) });
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await categoriesService.deleteCategory(id);
  res.status(204).end();
}
