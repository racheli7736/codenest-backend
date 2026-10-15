import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi';
import { api } from './helpers';

type Operation = { security?: unknown[] };
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function operations() {
  const result: { method: (typeof METHODS)[number]; path: string; url: string; secured: boolean }[] = [];
  for (const [path, item] of Object.entries(openApiDocument.paths as Record<string, Record<string, Operation>>)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const url = path.replace('{id}', path.startsWith('/api/images') ? '00000000-0000-4000-8000-000000000000' : '1');
      result.push({ method, path, url, secured: Array.isArray(op.security) && op.security.length > 0 });
    }
  }
  return result;
}

/** Every endpoint the server implements. If you add a route, add it here AND to openapi.ts. */
const IMPLEMENTED = [
  'GET /api/health',
  'POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me',
  'GET /api/users/me/dashboard', 'PATCH /api/users/me', 'PUT /api/users/me/avatar', 'DELETE /api/users/me/avatar',
  'GET /api/users/me/saved-posts', 'GET /api/users', 'GET /api/users/{id}', 'GET /api/users/{id}/followers',
  'GET /api/users/{id}/following', 'POST /api/users/{id}/follow', 'DELETE /api/users/{id}/follow',
  'GET /api/posts', 'POST /api/posts', 'GET /api/posts/{id}', 'PATCH /api/posts/{id}', 'DELETE /api/posts/{id}',
  'PUT /api/posts/{id}/image', 'DELETE /api/posts/{id}/image', 'POST /api/posts/{id}/like', 'DELETE /api/posts/{id}/like',
  'POST /api/posts/{id}/save', 'DELETE /api/posts/{id}/save',
  'GET /api/posts/{id}/comments', 'POST /api/posts/{id}/comments', 'DELETE /api/comments/{id}',
  'GET /api/categories', 'POST /api/categories', 'PATCH /api/categories/{id}', 'DELETE /api/categories/{id}',
  'GET /api/images/{id}',
];

describe('Swagger / OpenAPI', () => {
  it('is a valid OpenAPI 3 document', async () => {
    await expect(SwaggerParser.validate(structuredClone(openApiDocument) as never)).resolves.toBeDefined();
  });

  it('documents exactly the implemented endpoints', () => {
    const documented = operations().map((op) => `${op.method.toUpperCase()} ${op.path}`).sort();
    expect(documented).toEqual([...IMPLEMENTED].sort());
  });

  it('has the Bearer JWT security scheme (Authorize button)', () => {
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('every documented route exists, and every 🔒 route returns 401 without a token', async () => {
    for (const op of operations()) {
      const res = await api()[op.method](op.url);
      const routeMissing = res.status === 404 && String(res.body?.error?.message).startsWith('Route ');
      expect(routeMissing, `${op.method.toUpperCase()} ${op.path} is documented but not implemented`).toBe(false);
      if (op.secured) {
        expect(res.status, `${op.method.toUpperCase()} ${op.path} should require a token`).toBe(401);
      }
    }
  });

  it('serves Swagger UI at /api-docs and the JSON at /api-docs.json', async () => {
    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');

    const json = await api().get('/api-docs.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.0.3');
  });
});
