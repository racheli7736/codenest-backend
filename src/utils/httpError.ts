/** An error that is turned into a clean JSON HTTP response by the error handler. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
  new HttpError(400, code, message, details);

export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new HttpError(401, code, message);

export const forbidden = (message = 'You do not have permission to do this', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);

export const notFound = (resource: string) =>
  new HttpError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
