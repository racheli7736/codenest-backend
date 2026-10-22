import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createPost, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

async function setup() {
  const author = await createUser({ name: 'Author', email: 'author@test.dev' });
  const fan = await createUser({ name: 'Fan' });
  const category = await createCategory('Tips');
  const post = await createPost(author.user.id, category.id, { title: 'Public post', language: 'TYPESCRIPT' });
  await prisma.like.create({ data: { userId: fan.user.id, postId: post.id } });
  await prisma.savedPost.create({ data: { userId: fan.user.id, postId: post.id } });
  await prisma.comment.create({ data: { postId: post.id, authorId: fan.user.id, content: 'Nice!' } });
  await prisma.follow.create({ data: { followerId: fan.user.id, followingId: author.user.id } });
  return { author, fan, category, post };
}

describe('Guests (no token) can read', () => {
  it('the posts list — with search, filters and counts, never "liked/saved by me"', async () => {
    const { post } = await setup();
    const res = await api().get('/api/posts?search=public&language=TYPESCRIPT');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ id: post.id, likesCount: 1, commentsCount: 1, likedByMe: false, savedByMe: false });
  });

  it('a single post and its comments', async () => {
    const { post } = await setup();
    const one = await api().get(`/api/posts/${post.id}`);
    expect(one.status).toBe(200);
    expect(one.body.post).toMatchObject({ title: 'Public post', likedByMe: false });

    const comments = await api().get(`/api/posts/${post.id}/comments`);
    expect(comments.status).toBe(200);
    expect(comments.body.items[0].content).toBe('Nice!');
  });

  it('categories, profiles and follower lists — but never emails', async () => {
    const { author } = await setup();
    expect((await api().get('/api/categories')).status).toBe(200);

    const profile = await api().get(`/api/users/${author.user.id}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user).toMatchObject({ email: null, isMe: false, isFollowedByMe: false, followersCount: 1 });
    expect(JSON.stringify(profile.body)).not.toContain('author@test.dev');

    expect((await api().get(`/api/users/${author.user.id}/followers`)).body.total).toBe(1);
    expect((await api().get(`/api/users/${author.user.id}/following`)).status).toBe(200);
  });

  it('logged-in users still get their personal flags on the same endpoints', async () => {
    const { fan, post } = await setup();
    const res = await api().get(`/api/posts/${post.id}`).set('Authorization', fan.auth);
    expect(res.body.post).toMatchObject({ likedByMe: true, savedByMe: true });
  });
});

describe('Guests cannot change anything (401)', () => {
  it('like, save, comment, follow, create, edit, delete, upload', async () => {
    const { author, post, category } = await setup();
    const attempts = [
      api().post(`/api/posts/${post.id}/like`),
      api().delete(`/api/posts/${post.id}/like`),
      api().post(`/api/posts/${post.id}/save`),
      api().post(`/api/posts/${post.id}/comments`).send({ content: 'hi' }),
      api().post(`/api/users/${author.user.id}/follow`),
      api().post('/api/posts').send({ title: 'Guest post', content: 'x', categoryId: category.id }),
      api().patch(`/api/posts/${post.id}`).send({ title: 'Hacked' }),
      api().delete(`/api/posts/${post.id}`),
      api().put(`/api/posts/${post.id}/image`),
      api().post('/api/categories').send({ name: 'Nope' }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_MISSING');
    }
    expect(await prisma.like.count()).toBe(1);
    expect(await prisma.comment.count()).toBe(1);
  });

  it('the "following" feed needs login', async () => {
    await setup();
    const res = await api().get('/api/posts?feed=following');
    expect(res.status).toBe(401);
  });

  it('private pages stay private (saved posts, dashboard)', async () => {
    expect((await api().get('/api/users/me/saved-posts')).status).toBe(401);
    expect((await api().get('/api/users/me/dashboard')).status).toBe(401);
  });

  it('a bad or expired token on a public page is still rejected (so the app can log out)', async () => {
    const { post } = await setup();
    const res = await api().get(`/api/posts/${post.id}`).set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
