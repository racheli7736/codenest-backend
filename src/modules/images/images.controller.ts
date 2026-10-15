import type { Request, Response } from 'express';
import { z } from 'zod';
import { notFound } from '../../utils/httpError';
import * as imagesService from './images.service';

const imageIdSchema = z.object({ id: z.uuid() });

export async function getImage(req: Request, res: Response) {
  const parsed = imageIdSchema.safeParse(req.params);
  if (!parsed.success) throw notFound('Image');

  const image = await imagesService.getImage(parsed.data.id);
  res
    .status(200)
    .set({
      'Content-Type': image.mimeType,
      'Content-Length': String(image.size),
      // An image id never changes content (a new upload gets a new id), so browsers may cache it forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    .send(Buffer.from(image.data));
}
