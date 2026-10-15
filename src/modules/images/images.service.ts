import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../utils/httpError';

type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

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

/** Validates an uploaded file and returns the data ready to be stored. */
export function toImageData(file: Express.Multer.File | undefined) {
  if (!file) {
    throw badRequest('Please attach an image file in the "image" form field', 'FILE_REQUIRED');
  }
  const mimeType = detectImageType(file.buffer);
  if (!mimeType) {
    throw badRequest('The file is not a valid JPG, PNG or WEBP image', 'INVALID_FILE_TYPE');
  }
  return { data: new Uint8Array(file.buffer), mimeType, size: file.size };
}

export async function getImage(id: string) {
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) throw notFound('Image');
  return image;
}
