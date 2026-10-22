import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, forbidden, notFound, unauthorized } from '../../utils/httpError';
import { buildPage, toSkipTake } from '../../utils/pagination';
import { getStorageKeys, removeStoredObjects, uploadAndLinkImage } from '../images/images.service';
import { postInclude, toPostResponse } from './posts.serializer';
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from './posts.schemas';

interface Viewer {
  id: number;
  role: Role;
}

async function assertCategoryExists(categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw badRequest(`Category ${categoryId} does not exist`, 'CATEGORY_NOT_FOUND');
}

/** Throws 404 if the post does not exist. Also used by the comments module. */
export async function findPostOrThrow(postId: number) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, imageId: true },
  });
  if (!post) throw notFound('Post');
  return post;
}

async function loadPost(postId: number, viewerId: number | null) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude(viewerId) });
  if (!post) throw notFound('Post');
  return toPostResponse(post);
}

/** `viewer` is null for guests: they can read, but not use the "following" feed. */
export async function listPosts(viewer: Viewer | null, query: ListPostsQuery) {
  if (query.feed === 'following' && !viewer) {
    throw unauthorized('Log in to see posts from people you follow', 'TOKEN_MISSING');
  }
  const where: Prisma.PostWhereInput = {
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { content: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    // "following" feed: only posts whose author is followed by me
    ...(query.feed === 'following' && viewer ? { author: { followers: { some: { followerId: viewer.id } } } } : {}),
  };

  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    query.sort === 'popular'
      ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }];

  const [total, posts] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy,
      include: postInclude(viewer?.id ?? null),
      ...toSkipTake(query.page, query.limit),
    }),
  ]);

  return buildPage(posts.map(toPostResponse), total, query.page, query.limit);
}

export function getPost(viewer: Viewer | null, postId: number) {
  return loadPost(postId, viewer?.id ?? null);
}

export async function createPost(viewer: Viewer, input: CreatePostInput) {
  await assertCategoryExists(input.categoryId);
  const post = await prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      codeSnippet: input.codeSnippet ?? null,
      language: input.language ?? null,
      categoryId: input.categoryId,
      authorId: viewer.id, // always the logged-in user, never from the request body
    },
    include: postInclude(viewer.id),
  });
  return toPostResponse(post);
}

export async function updatePost(viewer: Viewer, postId: number, input: UpdatePostInput) {
  const post = await findPostOrThrow(postId);
  if (post.authorId !== viewer.id) throw forbidden('You can only edit your own posts');
  if (input.categoryId !== undefined) await assertCategoryExists(input.categoryId);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      title: input.title,
      content: input.content,
      codeSnippet: input.codeSnippet,
      language: input.language,
      categoryId: input.categoryId,
    },
    include: postInclude(viewer.id),
  });
  return toPostResponse(updated);
}

export async function deletePost(viewer: Viewer, postId: number) {
  const post = await findPostOrThrow(postId);
  if (post.authorId !== viewer.id && viewer.role !== 'ADMIN') {
    throw forbidden('You can only delete your own posts');
  }
  const storageKeys = await getStorageKeys([post.imageId]);
  // Comments, likes and saves are removed automatically (ON DELETE CASCADE). The image row is removed here.
  await prisma.$transaction([
    prisma.post.delete({ where: { id: postId } }),
    ...(post.imageId ? [prisma.image.delete({ where: { id: post.imageId } })] : []),
  ]);
  // The file in R2 is deleted only after the database change succeeded.
  await removeStoredObjects(storageKeys);
}

export async function setPostImage(viewer: Viewer, postId: number, file: Express.Multer.File | undefined) {
  const post = await findPostOrThrow(postId);
  if (post.authorId !== viewer.id) throw forbidden('You can only change the image of your own posts');
  const oldStorageKeys = await getStorageKeys([post.imageId]);

  await uploadAndLinkImage(file, async (tx, imageId) => {
    await tx.post.update({ where: { id: postId }, data: { imageId } });
    if (post.imageId) await tx.image.delete({ where: { id: post.imageId } });
  });
  await removeStoredObjects(oldStorageKeys);
  return loadPost(postId, viewer.id);
}

export async function removePostImage(viewer: Viewer, postId: number) {
  const post = await findPostOrThrow(postId);
  if (post.authorId !== viewer.id) throw forbidden('You can only change the image of your own posts');
  if (!post.imageId) return;
  const storageKeys = await getStorageKeys([post.imageId]);
  await prisma.image.delete({ where: { id: post.imageId } }); // post.imageId becomes NULL
  await removeStoredObjects(storageKeys);
}

export async function likePost(viewer: Viewer, postId: number) {
  await findPostOrThrow(postId);
  await prisma.like.upsert({
    where: { userId_postId: { userId: viewer.id, postId } },
    create: { userId: viewer.id, postId },
    update: {},
  });
  return { likesCount: await prisma.like.count({ where: { postId } }), likedByMe: true };
}

export async function unlikePost(viewer: Viewer, postId: number) {
  await findPostOrThrow(postId);
  await prisma.like.deleteMany({ where: { userId: viewer.id, postId } });
  return { likesCount: await prisma.like.count({ where: { postId } }), likedByMe: false };
}

export async function savePost(viewer: Viewer, postId: number) {
  await findPostOrThrow(postId);
  await prisma.savedPost.upsert({
    where: { userId_postId: { userId: viewer.id, postId } },
    create: { userId: viewer.id, postId },
    update: {},
  });
  return { savedByMe: true };
}

export async function unsavePost(viewer: Viewer, postId: number) {
  await findPostOrThrow(postId);
  await prisma.savedPost.deleteMany({ where: { userId: viewer.id, postId } });
  return { savedByMe: false };
}

