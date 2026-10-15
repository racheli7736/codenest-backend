import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../utils/httpError';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas';

const categorySelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  _count: { select: { posts: true } },
} as const;

function toCategoryResponse(category: {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: { posts: number };
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    postsCount: category._count.posts,
    createdAt: category.createdAt,
  };
}

/** Category names are unique ignoring upper/lower case ("Tips" and "tips" are the same). */
async function assertNameFree(name: string, exceptId?: number) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw conflict(`A category named "${name}" already exists`, 'CATEGORY_EXISTS');
}

async function assertExists(id: number) {
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!category) throw notFound('Category');
}

export async function listCategories() {
  const categories = await prisma.category.findMany({ select: categorySelect, orderBy: { name: 'asc' } });
  return categories.map(toCategoryResponse);
}

export async function createCategory(input: CreateCategoryInput) {
  await assertNameFree(input.name);
  const category = await prisma.category.create({
    data: { name: input.name, description: input.description ?? null },
    select: categorySelect,
  });
  return toCategoryResponse(category);
}

export async function updateCategory(id: number, input: UpdateCategoryInput) {
  await assertExists(id);
  if (input.name !== undefined) await assertNameFree(input.name, id);
  const category = await prisma.category.update({
    where: { id },
    data: { name: input.name, description: input.description },
    select: categorySelect,
  });
  return toCategoryResponse(category);
}

export async function deleteCategory(id: number) {
  await assertExists(id);
  const postsCount = await prisma.post.count({ where: { categoryId: id } });
  if (postsCount > 0) {
    throw conflict(
      `This category still has ${postsCount} post(s). Move or delete them first.`,
      'CATEGORY_IN_USE',
    );
  }
  await prisma.category.delete({ where: { id } });
}
