import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getStorage } from '../../lib/storage';
import { HttpError, badRequest, notFound } from '../../utils/httpError';

type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSIONS: Record<ImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Checks the first bytes of the file ("magic numbers") to make sure it really is an image.
 * We do not trust the file name or the type the browser claims.
 */
export function detectImageType(buffer: Buffer): ImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && pngSignature.every((byte, i) => buffer[i] === byte)) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Validates an uploaded file (presence and real image type; size is limited by multer). */
export function validateImageFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw badRequest('Please attach an image file in the "image" form field', 'FILE_REQUIRED');
  }
  const mimeType = detectImageType(file.buffer);
  if (!mimeType) {
    throw badRequest('The file is not a valid JPG, PNG or WEBP image', 'INVALID_FILE_TYPE');
  }
  return { buffer: file.buffer, mimeType, size: file.size };
}

/** Object key inside the R2 bucket. */
export function buildStorageKey(imageId: string, mimeType: string) {
  const extension = EXTENSIONS[mimeType as ImageMimeType] ?? 'bin';
  return `images/${imageId}.${extension}`;
}

/** Turns any storage failure into a clean 502 (or keeps the 503 "not configured" error). */
export function toStorageError(action: string, error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  console.error(`[storage] ${action} failed:`, error);
  return new HttpError(502, 'STORAGE_ERROR', 'Image storage is temporarily unavailable, please try again');
}

/**
 * Best effort removal of files whose database rows are already gone.
 * If R2 is unreachable the file stays as an "orphan"; `npm run images:cleanup-orphans` removes those later.
 * Never throws — the database is already consistent at this point.
 */
export async function removeStoredObjects(keys: (string | null | undefined)[]) {
  for (const key of keys) {
    if (!key) continue;
    try {
      await getStorage().deleteObject(key);
    } catch (error) {
      console.error(`[storage] Could not delete "${key}" (orphaned file, run images:cleanup-orphans):`, error);
    }
  }
}

/** The R2 keys of the given image rows (legacy rows without a key are skipped). */
export async function getStorageKeys(imageIds: (string | null | undefined)[]) {
  const ids = imageIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const rows = await prisma.image.findMany({ where: { id: { in: ids } }, select: { storageKey: true } });
  return rows.map((row) => row.storageKey).filter((key): key is string => Boolean(key));
}

/**
 * Uploads the file to R2 first, then — in ONE database transaction — creates the image row
 * and lets `link` attach it (to a post or user) and remove the old row.
 * If the database step fails, the new file is deleted from R2 again, so nothing is left behind.
 */
export async function uploadAndLinkImage<T>(
  file: Express.Multer.File | undefined,
  link: (tx: Prisma.TransactionClient, imageId: string) => Promise<T>,
): Promise<T> {
  const image = validateImageFile(file);
  const id = randomUUID();
  const storageKey = buildStorageKey(id, image.mimeType);

  try {
    await getStorage().putObject(storageKey, image.buffer, image.mimeType);
  } catch (error) {
    throw toStorageError('upload', error);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.image.create({
        data: { id, storageKey, storageVerifiedAt: new Date(), mimeType: image.mimeType, size: image.size },
      });
      return link(tx, id);
    });
  } catch (error) {
    await removeStoredObjects([storageKey]);
    throw error;
  }
}

/** Metadata needed to serve an image (the legacy bytes are loaded only when really needed). */
export async function getImageInfo(id: string) {
  const image = await prisma.image.findUnique({
    where: { id },
    select: { id: true, storageKey: true, mimeType: true, size: true },
  });
  if (!image) throw notFound('Image');
  return image;
}

/** LEGACY: bytes of an image that was stored in PostgreSQL and not migrated to R2 yet. */
export async function getLegacyImageBytes(id: string) {
  const image = await prisma.image.findUnique({ where: { id }, select: { data: true } });
  if (!image?.data) throw notFound('Image');
  return Buffer.from(image.data);
}
