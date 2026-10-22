import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { getStorage } from '../../lib/storage';
import { notFound } from '../../utils/httpError';
import * as imagesService from './images.service';

const imageIdSchema = z.object({ id: z.uuid() });

/** An image id always points to the same file (a new upload gets a new id), so it may be cached forever. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * GET /api/images/:id — the frontend puts this URL in <img src>.
 * - Image in R2, IMAGE_DELIVERY=proxy (default) → the API sends the file itself; the URL stays stable.
 * - Image in R2, IMAGE_DELIVERY=redirect → 302 to a short-lived signed URL (or the public bucket URL).
 * - Legacy image still in PostgreSQL → the bytes are sent directly (until it is migrated).
 */
export async function getImage(req: Request, res: Response) {
  const parsed = imageIdSchema.safeParse(req.params);
  if (!parsed.success) throw notFound('Image');

  const image = await imagesService.getImageInfo(parsed.data.id);

  if (image.storageKey && env.IMAGE_DELIVERY === 'proxy') {
    let body: Buffer | null;
    try {
      body = await getStorage().getObjectBytes(image.storageKey);
    } catch (error) {
      throw imagesService.toStorageError('download', error);
    }
    if (!body) {
      console.error(`[storage] Image ${image.id} points to "${image.storageKey}", which is missing in storage`);
      throw notFound('Image');
    }
    res
      .status(200)
      .set({ 'Content-Type': image.mimeType, 'Content-Length': String(body.length), 'Cache-Control': IMMUTABLE_CACHE })
      .send(body);
    return;
  }

  if (image.storageKey) {
    let target;
    try {
      target = await getStorage().getDownloadTarget(image.storageKey, image.mimeType);
    } catch (error) {
      throw imagesService.toStorageError('download', error);
    }
    if (target.kind === 'redirect') {
      res
        .set('Cache-Control', `${target.isPublic ? 'public' : 'private'}, max-age=${target.cacheSeconds}`)
        .redirect(302, target.url);
      return;
    }
    res
      .status(200)
      .set({ 'Content-Type': target.contentType, 'Cache-Control': 'private, max-age=300' })
      .send(target.body);
    return;
  }

  const bytes = await imagesService.getLegacyImageBytes(image.id);
  res
    .status(200)
    .set({ 'Content-Type': image.mimeType, 'Content-Length': String(bytes.length), 'Cache-Control': IMMUTABLE_CACHE })
    .send(bytes);
}
