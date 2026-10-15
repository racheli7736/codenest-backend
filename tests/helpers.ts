import type { ProgrammingLanguage, Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

export { prisma };
export const app = createApp();
export const api = () => request(app);

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "comments", "likes", "saved_posts", "follows", "posts", "categories", "users", "images" RESTART IDENTITY CASCADE',
  );
}

export const DEFAULT_PASSWORD = 'Password123';

let userCounter = 0;

export async function createUser(options: { name?: string; email?: string; role?: Role; password?: string } = {}) {
  userCounter += 1;
  const user = await prisma.user.create({
    data: {
      name: options.name ?? `Test User ${userCounter}`,
      email: options.email ?? `user${userCounter}-${Date.now()}@test.dev`,
      role: options.role ?? 'USER',
      passwordHash: await hashPassword(options.password ?? DEFAULT_PASSWORD),
    },
  });
  return { user, token: signAccessToken(user), auth: `Bearer ${signAccessToken(user)}` };
}

export async function createCategory(name = 'Tips') {
  return prisma.category.create({ data: { name } });
}

export async function createPost(
  authorId: number,
  categoryId: number,
  data: { title?: string; content?: string; language?: ProgrammingLanguage | null; createdAt?: Date } = {},
) {
  return prisma.post.create({
    data: {
      title: data.title ?? 'A test post',
      content: data.content ?? 'Some useful content',
      language: data.language ?? null,
      authorId,
      categoryId,
      ...(data.createdAt && { createdAt: data.createdAt }),
    },
  });
}

/** A real 1x1 pixel PNG image. */
export const PNG_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal JPEG header bytes (enough for type detection). */
export const JPEG_IMAGE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
