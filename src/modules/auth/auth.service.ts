import { prisma } from '../../lib/prisma';
import { conflict, notFound, unauthorized } from '../../utils/httpError';
import { signAccessToken } from '../../utils/jwt';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../utils/password';
import { currentUserSelect, toCurrentUser } from '../../utils/serializers';
import type { LoginInput, RegisterInput } from './auth.schemas';

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');

  // The role is never taken from the request — every new account is a regular USER.
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
    select: currentUserSelect,
  });
  return { token: signAccessToken(user), user: toCurrentUser(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...currentUserSelect, passwordHash: true },
  });

  const passwordOk = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyAgainstDummy(input.password);

  // Same message for "no such email" and "wrong password", so attackers learn nothing.
  if (!user || !passwordOk) throw unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');

  return { token: signAccessToken(user), user: toCurrentUser(user) };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: currentUserSelect });
  if (!user) throw notFound('User');
  return toCurrentUser(user);
}
