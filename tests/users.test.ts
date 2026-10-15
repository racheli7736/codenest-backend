import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createPost, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

describe('Personal area (dashboard) and profile editing', () => {
  it('dashboard returns my profile and correct counters', async () => {
    const me = await createUser({ name: 'Me' });
    const fan1 = await createUser();
    const fan2 = await createUser();
    const category = await createCategory();
    const p1 = await createPost(me.user.id, category.id);
    const p2 = await createPost(me.user.id, category.id);
    const othersPost = await createPost(fan1.user.id, category.id);

    await prisma.follow.createMany({
      data: [
        { followerId: fan1.user.id, followingId: me.user.id },
        { followerId: fan2.user.id, followingId: me.user.id },
        { followerId: me.user.id, followingId: fan1.user.id },
      ],
    });
    await prisma.like.createMany({
      data: [
        { userId: fan1.user.id, postId: p1.id },
        { userId: fan2.user.id, postId: p1.id },
        { userId: fan1.user.id, postId: p2.id },
        { userId: me.user.id, postId: othersPost.id }, // a like I gave — not counted as received
      ],
    });
    await prisma.savedPost.create({ data: { userId: me.user.id, postId: othersPost.id } });

    const res = await api().get('/api/users/me/dashboard').set('Authorization', me.auth);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: me.user.id, name: 'Me', email: me.user.email });
    expect(res.body.stats).toEqual({
      postsCount: 2,
      followersCount: 2,
      followingCount: 1,
      savedCount: 1,
      likesReceived: 3,
    });
  });

  it('dashboard requires a token', async () => {
    expect((await api().get('/api/users/me/dashboard')).status).toBe(401);
  });

  it('PATCH /api/users/me updates name and bio; "" clears the bio', async () => {
    const me = await createUser();
    const res = await api().patch('/api/users/me').set('Authorization', me.auth).send({ name: 'New Name', bio: 'Hi!' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'New Name', bio: 'Hi!' });

    const cleared = await api().patch('/api/users/me').set('Authorization', me.auth).send({ bio: '' });
    expect(cleared.body.user.bio).toBeNull();

    expect((await api().patch('/api/users/me').set('Authorization', me.auth).send({})).status).toBe(400);
    expect((await api().patch('/api/users/me').set('Authorization', me.auth).send({ name: 'x' })).status).toBe(400);
  });

  it('cannot change role or email through PATCH /me', async () => {
    const me = await createUser();
    await api().patch('/api/users/me').set('Authorization', me.auth).send({ name: 'Sneaky', role: 'ADMIN', email: 'x@y.z' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: me.user.id } });
    expect(stored.role).toBe('USER');
    expect(stored.email).toBe(me.user.email);
  });
});

describe('Profiles and privacy', () => {
  it('email is visible only to the owner and to admins', async () => {
    const target = await createUser({ email: 'private@test.dev' });
    const stranger = await createUser();
    const admin = await createUser({ role: 'ADMIN' });

    const asStranger = await api().get(`/api/users/${target.user.id}`).set('Authorization', stranger.auth);
    expect(asStranger.status).toBe(200);
    expect(asStranger.body.user.email).toBeNull();

    const asSelf = await api().get(`/api/users/${target.user.id}`).set('Authorization', target.auth);
    expect(asSelf.body.user).toMatchObject({ email: 'private@test.dev', isMe: true });

    const asAdmin = await api().get(`/api/users/${target.user.id}`).set('Authorization', admin.auth);
    expect(asAdmin.body.user.email).toBe('private@test.dev');
  });

  it('never exposes password hashes anywhere', async () => {
    const me = await createUser();
    const admin = await createUser({ role: 'ADMIN' });
    const responses = await Promise.all([
      api().get('/api/auth/me').set('Authorization', me.auth),
      api().get(`/api/users/${me.user.id}`).set('Authorization', me.auth),
      api().get('/api/users/me/dashboard').set('Authorization', me.auth),
      api().get('/api/users').set('Authorization', admin.auth),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toMatch(/\$2[aby]\$/);
    }
  });

  it('404 for a missing user', async () => {
    const me = await createUser();
    expect((await api().get('/api/users/9999').set('Authorization', me.auth)).status).toBe(404);
  });
});

describe('Admin: list users', () => {
  it('admin gets all users with search; a regular user gets 403', async () => {
    const admin = await createUser({ name: 'Admin', role: 'ADMIN' });
    const user = await createUser({ name: 'Regular Rita', email: 'rita@test.dev' });
    await createUser({ name: 'Someone Else' });

    const all = await api().get('/api/users').set('Authorization', admin.auth);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items[0]).toHaveProperty('email');
    expect(all.body.items[0]).toHaveProperty('role');

    const search = await api().get('/api/users?search=RITA').set('Authorization', admin.auth);
    expect(search.body.items.map((u: { id: number }) => u.id)).toEqual([user.user.id]);

    const forbidden = await api().get('/api/users').set('Authorization', user.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    expect((await api().get('/api/users')).status).toBe(401);
  });
});
