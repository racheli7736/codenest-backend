import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_JWT_SECRET } from './testEnv';
import { DEFAULT_PASSWORD, api, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

describe('POST /api/auth/register', () => {
  it('creates a USER account and returns a token', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Maya', email: 'Maya@Example.com', password: 'Secret123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Maya', email: 'maya@example.com', role: 'USER' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'maya@example.com' } });
    expect(stored.passwordHash).not.toBe('Secret123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash
  });

  it('ignores a "role" sent by the client (cannot self-register as admin)', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Hacker', email: 'h@example.com', password: 'Secret123', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser({ email: 'taken@example.com' });
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'TAKEN@example.com', password: 'Secret123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates the fields (400 with details)', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials (email is case-insensitive)', async () => {
    const { user } = await createUser({ email: 'noa@test.dev' });
    const res = await api().post('/api/auth/login').send({ email: 'NOA@test.dev', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    const payload = jwt.verify(res.body.token, TEST_JWT_SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(String(user.id));
    expect(payload.exp).toBeGreaterThan(payload.iat!); // token has an expiry
  });

  it('rejects a wrong password with 401', async () => {
    await createUser({ email: 'noa@test.dev' });
    const res = await api().post('/api/auth/login').send({ email: 'noa@test.dev', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with the same 401 message', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'Whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 for broken JSON', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/auth/me and token checks', () => {
  it('returns the current user for a valid token', async () => {
    const { user, auth } = await createUser();
    const res = await api().get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('401 TOKEN_MISSING without a token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('401 for a non-Bearer Authorization header', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('401 TOKEN_INVALID for a garbage token', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('401 TOKEN_INVALID for a token signed with another secret', async () => {
    const { user } = await createUser();
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-that-is-long-enough-123', { subject: String(user.id) });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('401 TOKEN_EXPIRED for an expired token', async () => {
    const { user } = await createUser();
    const expired = jwt.sign(
      { role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 },
      TEST_JWT_SECRET,
      { subject: String(user.id) },
    );
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('401 for a valid token whose user was deleted', async () => {
    const { user, auth } = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    const res = await api().get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(401);
  });

  it('uses the role from the database, not from the token', async () => {
    const { user } = await createUser({ role: 'USER' });
    // A token that *claims* ADMIN but belongs to a USER must not get admin rights
    const claimsAdmin = jwt.sign({ role: 'ADMIN' }, TEST_JWT_SECRET, { subject: String(user.id), expiresIn: '1h' });
    const res = await api().get('/api/users').set('Authorization', `Bearer ${claimsAdmin}`);
    expect(res.status).toBe(403);
  });
});
