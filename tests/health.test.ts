import { describe, expect, it } from 'vitest';
import { api } from './helpers';

describe('Health & basics', () => {
  it('GET /api/health → 200 with database connected', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('unknown route → 404 in the standard error format', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET / points to the docs', async () => {
    const res = await api().get('/');
    expect(res.status).toBe(200);
    expect(res.body.docs).toBe('/api-docs');
  });

  it('sends CORS headers', async () => {
    const res = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});
