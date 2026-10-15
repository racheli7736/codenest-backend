import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { forbidden, notFound } from '../../utils/httpError';
import { buildPage, toSkipTake } from '../../utils/pagination';
import { toUserSummary, userSummarySelect } from '../../utils/serializers';
import { findPostOrThrow } from '../posts/posts.service';
import type { CreateCommentInput } from './comments.schemas';

const commentInclude = { author: { select: userSummarySelect } } as const;

function toCommentResponse(comment: {
  id: number;
  content: string;
  postId: number;
  createdAt: Date;
  author: { id: number; name: string; avatarImageId: string | null };
}) {
  return {
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    author: toUserSummary(comment.author),
    createdAt: comment.createdAt,
  };
}

/** Oldest first, like a normal conversation. */
export async function listComments(postId: number, page: number, limit: number) {
  await findPostOrThrow(postId);
  const [total, comments] = await prisma.$transaction([
    prisma.comment.count({ where: { postId } }),
    prisma.comment.findMany({
      where: { postId },
      include: commentInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...toSkipTake(page, limit),
    }),
  ]);
  return buildPage(comments.map(toCommentResponse), total, page, limit);
}

export async function createComment(authorId: number, postId: number, input: CreateCommentInput) {
  await findPostOrThrow(postId);
  const comment = await prisma.comment.create({
    data: { content: input.content, postId, authorId },
    include: commentInclude,
  });
  return toCommentResponse(comment);
}

export async function deleteComment(viewer: { id: number; role: Role }, commentId: number) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  if (!comment) throw notFound('Comment');
  if (comment.authorId !== viewer.id && viewer.role !== 'ADMIN') {
    throw forbidden('You can only delete your own comments');
  }
  await prisma.comment.delete({ where: { id: commentId } });
}
