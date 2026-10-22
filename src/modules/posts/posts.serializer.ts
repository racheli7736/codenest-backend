import type { Prisma } from '@prisma/client';
import { imageUrl, toUserSummary, userSummarySelect } from '../../utils/serializers';

/** User ids start at 1, so 0 never matches anyone — used for guests (not logged in). */
const GUEST_ID = 0;

/**
 * What to load together with each post. `likes` and `savedBy` are filtered to the
 * current viewer only, so we can tell whether *I* liked / saved the post.
 * For guests (viewerId = null) both are always empty → likedByMe / savedByMe = false.
 */
export function postInclude(viewerId: number | null) {
  viewerId ??= GUEST_ID;
  return {
    author: { select: userSummarySelect },
    category: { select: { id: true, name: true } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    savedBy: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostInclude;
}

export type PostWithRelations = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

/** The exact JSON shape of a post returned by the API. */
export function toPostResponse(post: PostWithRelations) {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    codeSnippet: post.codeSnippet,
    language: post.language,
    imageUrl: imageUrl(post.imageId),
    category: post.category,
    author: toUserSummary(post.author),
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    likedByMe: post.likes.length > 0,
    savedByMe: post.savedBy.length > 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
