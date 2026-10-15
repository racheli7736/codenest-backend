import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../utils/httpError';
import { buildPage, toSkipTake } from '../../utils/pagination';
import { currentUserSelect, imageUrl, toCurrentUser, toUserSummary } from '../../utils/serializers';
import { toImageData } from '../images/images.service';
import { postInclude, toPostResponse } from '../posts/posts.serializer';
import type { ListUsersQuery, UpdateMeInput } from './users.schemas';

interface Viewer {
  id: number;
  role: Role;
}

async function assertUserExists(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound('User');
}

/** Everything the "My personal area" screen needs, in one request. */
export async function getDashboard(userId: number) {
  const [user, postsCount, followersCount, followingCount, savedCount, likesReceived] =
    await prisma.$transaction([
      prisma.user.findUnique({ where: { id: userId }, select: currentUserSelect }),
      prisma.post.count({ where: { authorId: userId } }),
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.savedPost.count({ where: { userId } }),
      prisma.like.count({ where: { post: { authorId: userId } } }),
    ]);
  if (!user) throw notFound('User');
  return {
    user: toCurrentUser(user),
    stats: { postsCount, followersCount, followingCount, savedCount, likesReceived },
  };
}

export async function updateMe(userId: number, input: UpdateMeInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, bio: input.bio },
    select: currentUserSelect,
  });
  return toCurrentUser(user);
}

export async function setAvatar(userId: number, file: Express.Multer.File | undefined) {
  const imageData = toImageData(file);
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarImageId: true } });
  if (!current) throw notFound('User');

  const user = await prisma.$transaction(async (tx) => {
    const image = await tx.image.create({ data: imageData, select: { id: true } });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { avatarImageId: image.id },
      select: currentUserSelect,
    });
    if (current.avatarImageId) await tx.image.delete({ where: { id: current.avatarImageId } });
    return updated;
  });
  return toCurrentUser(user);
}

export async function removeAvatar(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarImageId: true } });
  if (user?.avatarImageId) await prisma.image.delete({ where: { id: user.avatarImageId } });
}

/** Admin only: all users including email and role. */
export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { ...currentUserSelect, _count: { select: { posts: true } } },
      orderBy: { id: 'asc' },
      ...toSkipTake(query.page, query.limit),
    }),
  ]);

  const items = users.map((user) => ({ ...toCurrentUser(user), postsCount: user._count.posts }));
  return buildPage(items, total, query.page, query.limit);
}

/** A public profile. The email is shown only to the owner and to admins. */
export async function getProfile(viewer: Viewer, userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...currentUserSelect,
      _count: { select: { posts: true, followers: true, following: true } },
      followers: { where: { followerId: viewer.id }, select: { followerId: true } },
    },
  });
  if (!user) throw notFound('User');

  const canSeeEmail = viewer.id === user.id || viewer.role === 'ADMIN';
  return {
    id: user.id,
    name: user.name,
    email: canSeeEmail ? user.email : null,
    bio: user.bio,
    role: user.role,
    avatarUrl: imageUrl(user.avatarImageId),
    createdAt: user.createdAt,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    isFollowedByMe: user.followers.length > 0,
    isMe: viewer.id === user.id,
  };
}

const listedUserSelect = { id: true, name: true, bio: true, avatarImageId: true } as const;

function toListedUser(user: { id: number; name: string; bio: string | null; avatarImageId: string | null }) {
  return { ...toUserSummary(user), bio: user.bio };
}

/** People who follow `userId`. */
export async function listFollowers(userId: number, page: number, limit: number) {
  await assertUserExists(userId);
  const [total, rows] = await prisma.$transaction([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { follower: { select: listedUserSelect } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(page, limit),
    }),
  ]);
  return buildPage(rows.map((row) => toListedUser(row.follower)), total, page, limit);
}

/** People that `userId` follows. */
export async function listFollowing(userId: number, page: number, limit: number) {
  await assertUserExists(userId);
  const [total, rows] = await prisma.$transaction([
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { following: { select: listedUserSelect } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(page, limit),
    }),
  ]);
  return buildPage(rows.map((row) => toListedUser(row.following)), total, page, limit);
}

export async function follow(viewerId: number, targetId: number) {
  if (viewerId === targetId) throw badRequest('You cannot follow yourself', 'CANNOT_FOLLOW_SELF');
  await assertUserExists(targetId);
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    create: { followerId: viewerId, followingId: targetId },
    update: {},
  });
}

export async function unfollow(viewerId: number, targetId: number) {
  await assertUserExists(targetId);
  await prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: targetId } });
}

/** My saved posts, most recently saved first. Private: always for the logged-in user only. */
export async function listSavedPosts(viewerId: number, page: number, limit: number) {
  const [total, rows] = await prisma.$transaction([
    prisma.savedPost.count({ where: { userId: viewerId } }),
    prisma.savedPost.findMany({
      where: { userId: viewerId },
      select: { post: { include: postInclude(viewerId) } },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      ...toSkipTake(page, limit),
    }),
  ]);
  return buildPage(rows.map((row) => toPostResponse(row.post)), total, page, limit);
}
