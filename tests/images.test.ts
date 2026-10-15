import { beforeEach, describe, expect, it } from 'vitest';
import { JPEG_IMAGE, PNG_IMAGE, api, createCategory, createPost, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

describe('Profile picture', () => {
  it('upload → served publicly with the right content type; replace removes the old one', async () => {
    const me = await createUser();

    const upload = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', PNG_IMAGE, { filename: 'me.png', contentType: 'image/png' });
    expect(upload.status).toBe(200);
    const firstUrl: string = upload.body.user.avatarUrl;
    expect(firstUrl).toMatch(/^\/api\/images\/[0-9a-f-]{36}$/);

    const image = await api().get(firstUrl); // no token needed for <img src>
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(image.body as Buffer, PNG_IMAGE)).toBe(0);

    const replace = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', JPEG_IMAGE, { filename: 'me.jpg', contentType: 'image/jpeg' });
    expect(replace.body.user.avatarUrl).not.toBe(firstUrl);
    expect((await api().get(firstUrl)).status).toBe(404);
    expect(await prisma.image.count()).toBe(1);

    expect((await api().delete('/api/users/me/avatar').set('Authorization', me.auth)).status).toBe(204);
    const meAfter = await api().get('/api/auth/me').set('Authorization', me.auth);
    expect(meAfter.body.user.avatarUrl).toBeNull();
    expect(await prisma.image.count()).toBe(0);
  });

  it('rejects: no file (400), wrong type (400), fake image (400), too large (413), no token (401)', async () => {
    const me = await createUser();

    const noFile = await api().put('/api/users/me/avatar').set('Authorization', me.auth);
    expect(noFile.status).toBe(400);
    expect(noFile.body.error.code).toBe('FILE_REQUIRED');

    const textFile = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(textFile.status).toBe(400);
    expect(textFile.body.error.code).toBe('INVALID_FILE_TYPE');

    const fakePng = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    expect(fakePng.status).toBe(400);
    expect(fakePng.body.error.code).toBe('INVALID_FILE_TYPE');

    const big = Buffer.concat([PNG_IMAGE, Buffer.alloc(2 * 1024 * 1024)]);
    const tooBig = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', big, { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    const noToken = await api()
      .put('/api/users/me/avatar')
      .attach('image', PNG_IMAGE, { filename: 'me.png', contentType: 'image/png' });
    expect(noToken.status).toBe(401);
  });
});

describe('Post image', () => {
  it('only the owner can set it; deleting the post deletes the image', async () => {
    const owner = await createUser();
    const other = await createUser();
    const post = await createPost(owner.user.id, (await createCategory()).id);

    const byOther = await api()
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', other.auth)
      .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' });
    expect(byOther.status).toBe(403);

    const byOwner = await api()
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', owner.auth)
      .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' });
    expect(byOwner.status).toBe(200);
    const url: string = byOwner.body.post.imageUrl;
    expect((await api().get(url)).status).toBe(200);

    await api().delete(`/api/posts/${post.id}`).set('Authorization', owner.auth).expect(204);
    expect((await api().get(url)).status).toBe(404);
    expect(await prisma.image.count()).toBe(0);
  });

  it('owner can remove the image', async () => {
    const owner = await createUser();
    const post = await createPost(owner.user.id, (await createCategory()).id);
    await api()
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', owner.auth)
      .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' })
      .expect(200);

    await api().delete(`/api/posts/${post.id}/image`).set('Authorization', owner.auth).expect(204);
    const after = await api().get(`/api/posts/${post.id}`).set('Authorization', owner.auth);
    expect(after.body.post.imageUrl).toBeNull();
  });

  it('GET /api/images with a bad or unknown id → 404', async () => {
    expect((await api().get('/api/images/not-a-uuid')).status).toBe(404);
    expect((await api().get('/api/images/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});
