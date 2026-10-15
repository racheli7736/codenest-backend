import { compare, hash } from 'bcryptjs';
import { env } from '../config/env';

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Compares against a throwaway hash. Used when the email does not exist, so a failed
 * login takes the same time either way (attackers can't discover which emails exist).
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword('codenest-dummy-password');
  await compare(plain, await dummyHash);
  return false;
}
