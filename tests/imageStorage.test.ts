import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotConfiguredStorage, getStorage, setStorageForTests } from '../src/lib/storage';
import { R2Storage } from '../src/lib/storage/r2Storage';
import { findOrphanedObjects } from '../src/modules/images/imageMigration';
import { PNG_IMAGE, api, createCategory, createPost, createUser, memoryStorage, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());

/**
 * Makes the next prisma.$transaction() call fail like a database outage, then restores
 * the original exactly (vi.spyOn cannot safely restore Prisma client methods).
 */
function failNextTransaction() {
  const target = prisma as unknown as Record<string, unknown>;
  // The Prisma client is a Proxy: deleting our own override makes the real method visible again.
  const restore = () => {
    delete target.$transaction;
    if (typeof prisma.$transaction !== 'function') throw new Error('Could not restore prisma.$transaction');
  };
  Object.defineProperty(target, '$transaction', {
    configurable: true,
    writable: true,
    value: () => {
      restore();
      return Promise.reject(new Error('simulated database outage'));
    },
  });
  return restore;
}

function uploadAvatar(auth: string, image = PNG_IMAGE) {
  return api()
    .put('/api/users/me/avatar')
    .set('Authorization', auth)
    .attach('image', image, { filename: 'me.png', contentType: 'image/png' });
}

describe('Images are stored in object storage (Cloudflare R2), not in PostgreSQL', () => {
  it('upload: file goes to storage, the database keeps only key + metadata', async () => {
    const me = await createUser();
    const res = await uploadAvatar(me.auth);
    expect(res.status).toBe(200);

    const imageId = (res.body.user.avatarUrl as string).split('/').pop();
    const row = await prisma.image.findUniqueOrThrow({ where: { id: imageId } });
    expect(row.data).toBeNull(); // no bytes in the database
    expect(row.storageKey).toBe(`images/${imageId}.png`);
    expect(row.storageVerifiedAt).not.toBeNull();
    expect(row).toMatchObject({ mimeType: 'image/png', size: PNG_IMAGE.length });

    const stored = memoryStorage().objects.get(row.storageKey!);
    expect(stored && Buffer.compare(stored.body, PNG_IMAGE)).toBe(0);
    expect(stored?.contentType).toBe('image/png');
  });

  it('download: answers 302 with a temporary signed URL when the storage supports it', async () => {
    const me = await createUser();
    const url: string = (await uploadAvatar(me.auth)).body.user.avatarUrl;
    memoryStorage().redirectBaseUrl = 'https://bucket.example.r2.cloudflarestorage.com';

    const res = await api().get(url).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/bucket\.example\.r2\.cloudflarestorage\.com\/images\/.+\.png\?signature=/);
    expect(res.headers['cache-control']).toBe('private, max-age=300');
  });

  it('replace: the old file is deleted from storage, only the new one remains', async () => {
    const owner = await createUser();
    const post = await createPost(owner.user.id, (await createCategory()).id);
    const put = () =>
      api()
        .put(`/api/posts/${post.id}/image`)
        .set('Authorization', owner.auth)
        .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' });

    await put().expect(200);
    const firstKeys = [...memoryStorage().objects.keys()];
    await put().expect(200);
    const secondKeys = [...memoryStorage().objects.keys()];

    expect(firstKeys).toHaveLength(1);
    expect(secondKeys).toHaveLength(1);
    expect(secondKeys[0]).not.toBe(firstKeys[0]);
    expect(await prisma.image.count()).toBe(1);
  });

  it('delete: removing the image, the avatar or the whole post removes the file too', async () => {
    const owner = await createUser();
    const post = await createPost(owner.user.id, (await createCategory()).id);
    await api()
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', owner.auth)
      .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' })
      .expect(200);
    await uploadAvatar(owner.auth).expect(200);
    expect(memoryStorage().objects.size).toBe(2);

    await api().delete('/api/users/me/avatar').set('Authorization', owner.auth).expect(204);
    expect(memoryStorage().objects.size).toBe(1);

    await api().delete(`/api/posts/${post.id}`).set('Authorization', owner.auth).expect(204);
    expect(memoryStorage().objects.size).toBe(0);
    expect(await prisma.image.count()).toBe(0);
  });

  it('invalid files never reach the storage', async () => {
    const me = await createUser();
    const res = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(memoryStorage().objects.size).toBe(0);
    expect(await prisma.image.count()).toBe(0);
  });
});

describe('Failures keep PostgreSQL and storage consistent', () => {
  it('storage down during upload → 502, nothing written to the database, old image kept', async () => {
    const me = await createUser();
    const first = await uploadAvatar(me.auth);
    memoryStorage().failOn('put');

    const res = await uploadAvatar(me.auth);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_ERROR');

    const after = await api().get('/api/auth/me').set('Authorization', me.auth);
    expect(after.body.user.avatarUrl).toBe(first.body.user.avatarUrl); // unchanged
    expect(await prisma.image.count()).toBe(1);
    expect(memoryStorage().objects.size).toBe(1);
  });

  it('database fails after the upload → the new file is removed again (no orphan)', async () => {
    const me = await createUser();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const restore = failNextTransaction();

    const res = await uploadAvatar(me.auth);
    restore();
    expect(res.status).toBe(500);
    expect(memoryStorage().objects.size).toBe(0);
    expect(await prisma.image.count()).toBe(0);
  });

  it('storage down while deleting → the request still succeeds; the leftover file is found as an orphan', async () => {
    const me = await createUser();
    await uploadAvatar(me.auth).expect(200);
    memoryStorage().failOn('delete');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await api().delete('/api/users/me/avatar').set('Authorization', me.auth).expect(204);
    expect(await prisma.image.count()).toBe(0); // database is consistent
    expect(memoryStorage().objects.size).toBe(1); // file left behind…

    expect(await findOrphanedObjects({ minAgeMinutes: 0 })).toHaveLength(1); // …and detected
  });

  it('storage down while serving an image → 502 with a clear error', async () => {
    const me = await createUser();
    const url: string = (await uploadAvatar(me.auth)).body.user.avatarUrl;
    memoryStorage().failOn('url');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await api().get(url);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_ERROR');
  });

  it('R2 not configured → uploads answer 503, legacy images are still served', async () => {
    const me = await createUser();
    const legacy = await prisma.image.create({
      data: { data: new Uint8Array(PNG_IMAGE), mimeType: 'image/png', size: PNG_IMAGE.length },
    });
    const original = getStorage();
    setStorageForTests(new NotConfiguredStorage());
    try {
      const upload = await uploadAvatar(me.auth);
      expect(upload.status).toBe(503);
      expect(upload.body.error.code).toBe('STORAGE_NOT_CONFIGURED');

      const legacyRes = await api().get(`/api/images/${legacy.id}`);
      expect(legacyRes.status).toBe(200);
      expect(Buffer.compare(legacyRes.body as Buffer, PNG_IMAGE)).toBe(0);
    } finally {
      setStorageForTests(original);
    }
  });

  it('database fails while deleting a post → 500 and the file is NOT removed from storage', async () => {
    const owner = await createUser();
    const post = await createPost(owner.user.id, (await createCategory()).id);
    await api()
      .put(`/api/posts/${post.id}/image`)
      .set('Authorization', owner.auth)
      .attach('image', PNG_IMAGE, { filename: 'x.png', contentType: 'image/png' })
      .expect(200);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const restore = failNextTransaction();

    const res = await api().delete(`/api/posts/${post.id}`).set('Authorization', owner.auth);
    restore();
    expect(res.status).toBe(500);
    // Post, image row and file all still exist — nothing points to a missing file
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.image.count()).toBe(1);
    expect(memoryStorage().objects.size).toBe(1);
  });
});

describe('Legacy images (bytes still in PostgreSQL) keep working during the migration', () => {
  it('are served directly with 200', async () => {
    const legacy = await prisma.image.create({
      data: { data: new Uint8Array(PNG_IMAGE), mimeType: 'image/png', size: PNG_IMAGE.length },
    });
    const res = await api().get(`/api/images/${legacy.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(res.body as Buffer, PNG_IMAGE)).toBe(0);
  });

  it('the database refuses an image with neither a storage key nor bytes', async () => {
    await expect(prisma.image.create({ data: { mimeType: 'image/png', size: 10 } })).rejects.toThrow();
  });
});

describe('R2 client configuration', () => {
  it('builds public URLs when a public bucket URL is configured (no signing needed)', async () => {
    const storage = new R2Storage({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: 'codenest',
      publicBaseUrl: 'https://images.example.com',
      signedUrlTtlSeconds: 3600,
    });
    const target = await storage.getDownloadTarget('images/abc.png');
    expect(target).toEqual({ kind: 'redirect', url: 'https://images.example.com/images/abc.png', cacheSeconds: 86400, isPublic: true });
  });

  it('creates signed URLs that expire, without exposing the secret key', async () => {
    const storage = new R2Storage({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'super-secret-value',
      bucket: 'codenest',
      signedUrlTtlSeconds: 600,
    });
    const target = await storage.getDownloadTarget('images/abc.png');
    expect(target.kind).toBe('redirect');
    if (target.kind !== 'redirect') return;
    const url = new URL(target.url);
    expect(url.origin + url.pathname).toBe('https://account.r2.cloudflarestorage.com/codenest/images/abc.png');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(target.url).not.toContain('super-secret-value');
    expect(target.cacheSeconds).toBeLessThan(600);
  });
});
