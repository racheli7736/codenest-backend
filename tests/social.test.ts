import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createPost, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

async function setup() {
  const alice = await createUser({ name: 'Alice' });
  const bob = await createUser({ name: 'Bob' });
  const admin = await createUser({ name: 'Admin', role: 'ADMIN' });
  const category = await createCategory();
  const post = await createPost(alice.user.id, category.id);
  return { alice, bob, admin, post };
}

describe('Likes', () => {
  it('like is counted once even if sent twice, and can be removed', async () => {
    const { alice, bob, post } = await setup();

    const first = await api().post(`/api/posts/${post.id}/like`).set('Authorization', bob.auth);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ likesCount: 1, likedByMe: true });

    const second = await api().post(`/api/posts/${post.id}/like`).set('Authorization', bob.auth);
    expect(second.body.likesCount).toBe(1);

    const asBob = await api().get(`/api/posts/${post.id}`).set('Authorization', bob.auth);
    expect(asBob.body.post).toMatchObject({ likesCount: 1, likedByMe: true });
    const asAlice = await api().get(`/api/posts/${post.id}`).set('Authorization', alice.auth);
    expect(asAlice.body.post).toMatchObject({ likesCount: 1, likedByMe: false });

    const unlike = await api().delete(`/api/posts/${post.id}/like`).set('Authorization', bob.auth);
    expect(unlike.body).toEqual({ likesCount: 0, likedByMe: false });
  });

  it('404 when liking a missing post', async () => {
    const { bob } = await setup();
    expect((await api().post('/api/posts/9999/like').set('Authorization', bob.auth)).status).toBe(404);
  });
});

describe('Saved posts (private)', () => {
  it('saves and unsaves; each user sees only their own saved list', async () => {
    const { alice, bob, post } = await setup();

    const save = await api().post(`/api/posts/${post.id}/save`).set('Authorization', bob.auth);
    expect(save.status).toBe(200);
    expect(save.body).toEqual({ savedByMe: true });

    const bobSaved = await api().get('/api/users/me/saved-posts').set('Authorization', bob.auth);
    expect(bobSaved.body.items.map((p: { id: number }) => p.id)).toEqual([post.id]);
    expect(bobSaved.body.items[0].savedByMe).toBe(true);

    const aliceSaved = await api().get('/api/users/me/saved-posts').set('Authorization', alice.auth);
    expect(aliceSaved.body.items).toEqual([]);

    await api().delete(`/api/posts/${post.id}/save`).set('Authorization', bob.auth).expect(200);
    const after = await api().get('/api/users/me/saved-posts').set('Authorization', bob.auth);
    expect(after.body.total).toBe(0);
  });

  it('saved list requires a token', async () => {
    expect((await api().get('/api/users/me/saved-posts')).status).toBe(401);
  });
});

describe('Comments', () => {
  it('create and list comments (oldest first), commentsCount updates', async () => {
    const { alice, bob, post } = await setup();
    const c1 = await api().post(`/api/posts/${post.id}/comments`).set('Authorization', bob.auth).send({ content: 'First!' });
    expect(c1.status).toBe(201);
    expect(c1.body.comment).toMatchObject({ content: 'First!', postId: post.id, author: { id: bob.user.id } });
    await api().post(`/api/posts/${post.id}/comments`).set('Authorization', alice.auth).send({ content: 'Thanks' }).expect(201);

    const list = await api().get(`/api/posts/${post.id}/comments`).set('Authorization', alice.auth);
    expect(list.status).toBe(200);
    expect(list.body.items.map((c: { content: string }) => c.content)).toEqual(['First!', 'Thanks']);
    expect(list.body.total).toBe(2);

    const fetched = await api().get(`/api/posts/${post.id}`).set('Authorization', alice.auth);
    expect(fetched.body.post.commentsCount).toBe(2);
  });

  it('rejects an empty comment (400) and a missing post (404)', async () => {
    const { bob, post } = await setup();
    expect((await api().post(`/api/posts/${post.id}/comments`).set('Authorization', bob.auth).send({ content: '   ' })).status).toBe(400);
    expect((await api().post('/api/posts/9999/comments').set('Authorization', bob.auth).send({ content: 'hi' })).status).toBe(404);
  });

  it('delete: owner 204, other user 403, admin 204', async () => {
    const { alice, bob, admin, post } = await setup();
    const c1 = await prisma.comment.create({ data: { postId: post.id, authorId: bob.user.id, content: 'mine' } });
    const c2 = await prisma.comment.create({ data: { postId: post.id, authorId: bob.user.id, content: 'rude' } });

    expect((await api().delete(`/api/comments/${c1.id}`).set('Authorization', alice.auth)).status).toBe(403);
    expect((await api().delete(`/api/comments/${c1.id}`).set('Authorization', bob.auth)).status).toBe(204);
    expect((await api().delete(`/api/comments/${c2.id}`).set('Authorization', admin.auth)).status).toBe(204);
    expect((await api().delete(`/api/comments/${c2.id}`).set('Authorization', admin.auth)).status).toBe(404);
  });
});

describe('Follows', () => {
  it('follow / unfollow, with counts and lists', async () => {
    const { alice, bob } = await setup();

    expect((await api().post(`/api/users/${alice.user.id}/follow`).set('Authorization', bob.auth)).status).toBe(204);
    // following twice is harmless
    expect((await api().post(`/api/users/${alice.user.id}/follow`).set('Authorization', bob.auth)).status).toBe(204);

    const profile = await api().get(`/api/users/${alice.user.id}`).set('Authorization', bob.auth);
    expect(profile.body.user).toMatchObject({ followersCount: 1, followingCount: 0, isFollowedByMe: true, isMe: false });

    const followers = await api().get(`/api/users/${alice.user.id}/followers`).set('Authorization', bob.auth);
    expect(followers.body.items.map((u: { id: number }) => u.id)).toEqual([bob.user.id]);

    const following = await api().get(`/api/users/${bob.user.id}/following`).set('Authorization', alice.auth);
    expect(following.body.items.map((u: { id: number }) => u.id)).toEqual([alice.user.id]);

    expect((await api().delete(`/api/users/${alice.user.id}/follow`).set('Authorization', bob.auth)).status).toBe(204);
    const after = await api().get(`/api/users/${alice.user.id}`).set('Authorization', bob.auth);
    expect(after.body.user).toMatchObject({ followersCount: 0, isFollowedByMe: false });
  });

  it('cannot follow yourself (400) or a missing user (404)', async () => {
    const { alice } = await setup();
    const self = await api().post(`/api/users/${alice.user.id}/follow`).set('Authorization', alice.auth);
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_FOLLOW_SELF');
    expect((await api().post('/api/users/9999/follow').set('Authorization', alice.auth)).status).toBe(404);
  });

  it('the database itself blocks self-follow (CHECK constraint)', async () => {
    const { alice } = await setup();
    await expect(
      prisma.follow.create({ data: { followerId: alice.user.id, followingId: alice.user.id } }),
    ).rejects.toThrow();
  });
});
