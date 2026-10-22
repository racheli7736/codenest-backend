import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createPost, createUser, resetDatabase } from './helpers';

beforeEach(resetDatabase);

describe('Categories', () => {
  it('anyone (also guests) can list categories (sorted, with post counts)', async () => {
    const user = await createUser();
    const tips = await createCategory('Tips');
    await createCategory('Architecture');
    await createPost(user.user.id, tips.id);

    const res = await api().get('/api/categories').set('Authorization', user.auth);
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(['Architecture', 'Tips']);
    expect(res.body.items[1].postsCount).toBe(1);

    expect((await api().get('/api/categories')).status).toBe(200); // public
  });

  it('only admins can create (user → 403, admin → 201)', async () => {
    const user = await createUser();
    const admin = await createUser({ role: 'ADMIN' });

    const asUser = await api().post('/api/categories').set('Authorization', user.auth).send({ name: 'DevOps' });
    expect(asUser.status).toBe(403);

    const asAdmin = await api()
      .post('/api/categories')
      .set('Authorization', admin.auth)
      .send({ name: 'DevOps', description: 'CI/CD' });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.category).toMatchObject({ name: 'DevOps', description: 'CI/CD', postsCount: 0 });
  });

  it('names are unique, ignoring upper/lower case (409)', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    await createCategory('Tips');
    const res = await api().post('/api/categories').set('Authorization', admin.auth).send({ name: 'TIPS' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_EXISTS');
  });

  it('validates the name (400)', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().post('/api/categories').set('Authorization', admin.auth).send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('admin can edit; user cannot', async () => {
    const user = await createUser();
    const admin = await createUser({ role: 'ADMIN' });
    const category = await createCategory('Tips');

    expect((await api().patch(`/api/categories/${category.id}`).set('Authorization', user.auth).send({ name: 'X1' })).status).toBe(403);
    const res = await api().patch(`/api/categories/${category.id}`).set('Authorization', admin.auth).send({ name: 'Quick Tips' });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Quick Tips');

    expect((await api().patch('/api/categories/9999').set('Authorization', admin.auth).send({ name: 'Nope' })).status).toBe(404);
  });

  it('cannot delete a category that has posts (409); can delete an empty one (204)', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const used = await createCategory('Used');
    const empty = await createCategory('Empty');
    await createPost(admin.user.id, used.id);

    const inUse = await api().delete(`/api/categories/${used.id}`).set('Authorization', admin.auth);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');

    expect((await api().delete(`/api/categories/${empty.id}`).set('Authorization', admin.auth)).status).toBe(204);
  });
});
