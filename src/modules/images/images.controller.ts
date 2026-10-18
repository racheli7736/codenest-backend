import type { Request, Response } from 'express';
import { z } from 'zod';
import { getStorage } from '../../lib/storage';
import { notFound } from '../../utils/httpError';
import * as imagesService from './images.service';

const imageIdSchema = z.object({ id: z.uuid() });

/**
 * GET /api/images/:id
 * - Image in R2  → 302 redirect to a short-lived signed URL (or the public bucket URL).
 * - Legacy image still in PostgreSQL → the bytes are sent directly (until it is migrated).
 * The frontend keeps using the same imageUrl in <img src> — browsers follow the redirect.
 */
export async function getImage(req: Request, res: Response) {
  const parsed = imageIdSchema.safeParse(req.params);
  if (!parsed.success) throw notFound('Image');

  const image = await imagesService.getImageInfo(parsed.data.id);

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
    .set({
      'Content-Type': image.mimeType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    .send(bytes);
}
