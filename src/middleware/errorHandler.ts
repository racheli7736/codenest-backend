import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError';

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
}

/** Any URL that no route matched. */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} does not exist`);
};

/** Converts every thrown error into the same JSON shape: { error: { code, message, details? } } */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    return sendError(res, 400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', details);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'Image must be 2MB or smaller');
    }
    return sendError(res, 400, 'UPLOAD_ERROR', `Upload failed: send one file in the "image" field (${err.code})`);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return sendError(res, 409, 'CONFLICT', 'A record with this value already exists');
    if (err.code === 'P2025') return sendError(res, 404, 'NOT_FOUND', 'Record not found');
    if (err.code === 'P2003') return sendError(res, 409, 'CONFLICT', 'This record is linked to other data');
  }

  // Errors from express.json(): broken JSON or a body that is too big
  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    }
    if (err.type === 'entity.too.large') {
      return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
  }

  console.error('Unexpected error:', err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server');
};
