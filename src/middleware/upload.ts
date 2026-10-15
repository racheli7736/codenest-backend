import multer from 'multer';
import { HttpError } from '../utils/httpError';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Accepts ONE image in the multipart form field named "image".
 * The file is kept in memory and then saved to the database (not to disk),
 * because disks on free cloud hosting are wiped on every restart.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Only JPG, PNG or WEBP images are allowed'));
    }
  },
}).single('image');
