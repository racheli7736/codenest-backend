import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createPost, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

async function setup() {
  const owner = await createUser({ name: 'Owner' });
  const other = await createUser({ name: 'Other' });
  const admin = await createUser({ name: 'Admin', role: 'ADMIN' });
  const category = await createCategory('Tips');
  return { owner, other, admin, category };
}

describe('Posts CRUD', () => {
  it('creates a post — the author comes from the token, not the body', async () => {
    const { owner, other, category } = await setup();
    const res = await api()
      .post('/api/posts')
      .set('Authorization', owner.auth)
      .send({
        title: 'Hello CodeNest',
        content: 'First post',
        codeSnippet: 'console.log("hi")',
        language: 'JAVASCRIPT',
        categoryId: category.id,
        authorId: other.user.id, // must be ignored
      });

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      title: 'Hello CodeNest',
      language: 'JAVASCRIPT',
      category: { id: category.id, name: 'Tips' },
      author: { id: owner.user.id },
      likesCount: 0,
      commentsCount: 0,
      likedByMe: false,
      savedByMe: false,
      imageUrl: null,
    });
    const stored = await prisma.post.findUniqueOrThrow({ where: { id: res.body.post.id } });
    expect(stored.authorId).toBe(owner.user.id);
  });

  it('requires a token (401)', async () => {
    const res = await api().post('/api/posts').send({ title: 'x', content: 'y', categoryId: 1 });
    expect(res.status).toBe(401);
  });

  it('validates the body (400)', async () => {
    const { owner } = await setup();
    const res = await api()
      .post('/api/posts')
      .set('Authorization', owner.auth)
      .send({ title: 'ab', content: '', language: 'COBOL' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'content', 'language', 'categoryId']));
  });

  it('rejects a category that does not exist (400)', async () => {
    const { owner } = await setup();
    const res = await api()
      .post('/api/posts')
      .set('Authorization', owner.auth)
      .send({ title: 'Valid title', content: 'Body', categoryId: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('gets a single post, 404 for a missing one, 400 for a bad id', async () => {
    const { owner, category } = await setup();
    const post = await createPost(owner.user.id, category.id, { title: 'Findable' });

    const ok = await api().get(`/api/posts/${post.id}`).set('Authorization', owner.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.post.title).toBe('Findable');

    const missing = await api().get('/api/posts/99999').set('Authorization', owner.auth);
    expect(missing.status).toBe(404);

    const bad = await api().get('/api/posts/abc').set('Authorization', owner.auth);
    expect(bad.status).toBe(400);
  });

  it('only the owner can edit (others and even admins get 403)', async () => {
    const { owner, other, admin, category } = await setup();
    const post = await createPost(owner.user.id, category.id);

    const byOther = await api().patch(`/api/posts/${post.id}`).set('Authorization', other.auth).send({ title: 'Hacked!' });
    expect(byOther.status).toBe(403);

    const byAdmin = await api().patch(`/api/posts/${post.id}`).set('Authorization', admin.auth).send({ title: 'Admin edit' });
    expect(byAdmin.status).toBe(403);

    const byOwner = await api()
      .patch(`/api/posts/${post.id}`)
      .set('Authorization', owner.auth)
      .send({ title: 'Updated title', codeSnippet: '' });
    expect(byOwner.status).toBe(200);
    expect(byOwner.body.post.title).toBe('Updated title');
    expect(byOwner.body.post.codeSnippet).toBeNull();
    expect(byOwner.body.post.content).toBe('Some useful content'); // unchanged
  });

  it('rejects an empty update (400)', async () => {
    const { owner, category } = await setup();
    const post = await createPost(owner.user.id, category.id);
    const res = await api().patch(`/api/posts/${post.id}`).set('Authorization', owner.auth).send({});
    expect(res.status).toBe(400);
  });

  it('delete: other user 403, owner 204', async () => {
    const { owner, other, category } = await setup();
    const post = await createPost(owner.user.id, category.id);

    expect((await api().delete(`/api/posts/${post.id}`).set('Authorization', other.auth)).status).toBe(403);
    expect((await api().delete(`/api/posts/${post.id}`).set('Authorization', owner.auth)).status).toBe(204);
    expect((await api().get(`/api/posts/${post.id}`).set('Authorization', owner.auth)).status).toBe(404);
  });

  it('admin can delete any post, and its comments/likes/saves are removed too', async () => {
    const { owner, other, admin, category } = await setup();
    const post = await createPost(owner.user.id, category.id);
    await prisma.comment.create({ data: { postId: post.id, authorId: other.user.id, content: 'hi' } });
    await prisma.like.create({ data: { postId: post.id, userId: other.user.id } });
    await prisma.savedPost.create({ data: { postId: post.id, userId: other.user.id } });

    const res = await api().delete(`/api/posts/${post.id}`).set('Authorization', admin.auth);
    expect(res.status).toBe(204);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.like.count()).toBe(0);
    expect(await prisma.savedPost.count()).toBe(0);
  });
});

describe('Posts list — search, filter, sort, pagination', () => {
  async function seedPosts() {
    const { owner, other, category } = await setup();
    const tools = await createCategory('Tools');
    const hour = 3_600_000;
    const now = Date.now();
    const p1 = await createPost(owner.user.id, category.id, {
      title: 'React hooks guide', content: 'useEffect explained', language: 'TYPESCRIPT', createdAt: new Date(now - 3 * hour),
    });
    const p2 = await createPost(other.user.id, tools.id, {
      title: 'Python tricks', content: 'List comprehensions and REACT-ive thinking', language: 'PYTHON', createdAt: new Date(now - 2 * hour),
    });
    const p3 = await createPost(other.user.id, category.id, {
      title: 'SQL joins', content: 'Inner vs left join', language: 'SQL', createdAt: new Date(now - 1 * hour),
    });
    return { owner, other, category, tools, p1, p2, p3 };
  }

  const ids = (body: { items: { id: number }[] }) => body.items.map((post) => post.id);

  it('default: newest first, with pagination info', async () => {
    const { owner, p1, p2, p3 } = await seedPosts();
    const res = await api().get('/api/posts').set('Authorization', owner.auth);
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([p3.id, p2.id, p1.id]);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 3, totalPages: 1 });
  });

  it('paginates', async () => {
    const { owner, p1 } = await seedPosts();
    const res = await api().get('/api/posts?page=2&limit=2').set('Authorization', owner.auth);
    expect(ids(res.body)).toEqual([p1.id]);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('searches title and content, case-insensitive', async () => {
    const { owner, p1, p2 } = await seedPosts();
    const res = await api().get('/api/posts?search=react').set('Authorization', owner.auth);
    expect(ids(res.body).sort()).toEqual([p1.id, p2.id].sort());
  });

  it('filters by category, language and author', async () => {
    const { owner, other, tools, p2, p3 } = await seedPosts();
    const byCategory = await api().get(`/api/posts?categoryId=${tools.id}`).set('Authorization', owner.auth);
    expect(ids(byCategory.body)).toEqual([p2.id]);

    const byLanguage = await api().get('/api/posts?language=SQL').set('Authorization', owner.auth);
    expect(ids(byLanguage.body)).toEqual([p3.id]);

    const byAuthor = await api().get(`/api/posts?authorId=${other.user.id}`).set('Authorization', owner.auth);
    expect(ids(byAuthor.body)).toEqual([p3.id, p2.id]);

    const combined = await api()
      .get(`/api/posts?authorId=${other.user.id}&language=PYTHON&search=python`)
      .set('Authorization', owner.auth);
    expect(ids(combined.body)).toEqual([p2.id]);
  });

  it('feed=following shows only posts of people I follow', async () => {
    const { owner, other, p2, p3 } = await seedPosts();
    const before = await api().get('/api/posts?feed=following').set('Authorization', owner.auth);
    expect(before.body.items).toEqual([]);

    await prisma.follow.create({ data: { followerId: owner.user.id, followingId: other.user.id } });
    const after = await api().get('/api/posts?feed=following').set('Authorization', owner.auth);
    expect(ids(after.body)).toEqual([p3.id, p2.id]);
  });

  it('sort=popular puts the most liked first', async () => {
    const { owner, other, p1, p2, p3 } = await seedPosts();
    const third = await createUser();
    await prisma.like.createMany({
      data: [
        { postId: p1.id, userId: owner.user.id },
        { postId: p1.id, userId: other.user.id },
        { postId: p1.id, userId: third.user.id },
        { postId: p2.id, userId: owner.user.id },
      ],
    });
    const res = await api().get('/api/posts?sort=popular').set('Authorization', owner.auth);
    expect(ids(res.body)).toEqual([p1.id, p2.id, p3.id]);
    expect(res.body.items[0]).toMatchObject({ likesCount: 3, likedByMe: true });
  });

  it('rejects invalid query values (400)', async () => {
    const { owner } = await seedPosts();
    expect((await api().get('/api/posts?sort=random').set('Authorization', owner.auth)).status).toBe(400);
    expect((await api().get('/api/posts?limit=500').set('Authorization', owner.auth)).status).toBe(400);
    expect((await api().get('/api/posts?language=COBOL').set('Authorization', owner.auth)).status).toBe(400);
  });
});
