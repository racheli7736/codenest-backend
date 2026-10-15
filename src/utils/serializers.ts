import type { Role } from '@prisma/client';

/** Turns a stored image id into the URL the frontend can put in <img src>. */
export function imageUrl(imageId: string | null | undefined): string | null {
  return imageId ? `/api/images/${imageId}` : null;
}

/** Minimal user info shown next to posts and comments. */
export const userSummarySelect = { id: true, name: true, avatarImageId: true } as const;

export function toUserSummary(user: { id: number; name: string; avatarImageId: string | null }) {
  return { id: user.id, name: user.name, avatarUrl: imageUrl(user.avatarImageId) };
}

/** Full info about the logged-in user (includes private email). Never includes the password hash. */
export const currentUserSelect = {
  id: true,
  name: true,
  email: true,
  bio: true,
  role: true,
  avatarImageId: true,
  createdAt: true,
} as const;

export function toCurrentUser(user: {
  id: number;
  name: string;
  email: string;
  bio: string | null;
  role: Role;
  avatarImageId: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    role: user.role,
    avatarUrl: imageUrl(user.avatarImageId),
    createdAt: user.createdAt,
  };
}
