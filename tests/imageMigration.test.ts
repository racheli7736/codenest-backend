import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backupLegacyImages,
  deleteOrphanedObjects,
  findOrphanedObjects,
  migrateLegacyImages,
  purgeLegacyImageData,
  verifyStoredImages,
} from '../src/modules/images/imageMigration';
import { JPEG_IMAGE, PNG_IMAGE, api, createCategory, createUser, memoryStorage, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());

/** Images exactly as the old version stored them: bytes in PostgreSQL, no storage key. */
async function createLegacyImages() {
  const owner = await createUser();
  const category = await createCategory();
  const avatar = await prisma.image.create({
    data: { data: new Uint8Array(PNG_IMAGE), mimeType: 'image/png', size: PNG_IMAGE.length },
  });
  const postImage = await prisma.image.create({
    data: { data: new Uint8Array(JPEG_IMAGE), mimeType: 'image/jpeg', size: JPEG_IMAGE.length },
  });
  await prisma.user.update({ where: { id: owner.user.id }, data: { avatarImageId: avatar.id } });
  const post = await prisma.post.create({
    data: { title: 'Legacy post', content: 'x', authorId: owner.user.id, categoryId: category.id, imageId: postImage.id },
  });
  return { owner, avatar, postImage, post };
}

describe('Migrating legacy images from PostgreSQL to R2', () => {
  it('dry run changes nothing', async () => {
    await createLegacyImages();
    const result = await migrateLegacyImages({ dryRun: true });
    expect(result).toMatchObject({ scanned: 2, migrated: 0, dryRun: true });
    expect(memoryStorage().objects.size).toBe(0);
    expect(await prisma.image.count({ where: { storageKey: { not: null } } })).toBe(0);
  });

  it('uploads, verifies, records the key — and keeps the old bytes as a backup', async () => {
    const { avatar, postImage } = await createLegacyImages();
    const result = await migrateLegacyImages();
    expect(result).toMatchObject({ scanned: 2, migrated: 2, failed: [] });

    const rows = await prisma.image.findMany({ orderBy: { id: 'asc' } });
    for (const row of rows) {
      expect(row.storageKey).toMatch(new RegExp(`^images/${row.id}\\.(png|jpg)$`));
      expect(row.storageVerifiedAt).not.toBeNull();
      expect(row.data).not.toBeNull(); // NOT deleted yet
      const stored = memoryStorage().objects.get(row.storageKey!);
      expect(Buffer.compare(stored!.body, Buffer.from(row.data!))).toBe(0);
    }
    expect(memoryStorage().objects.get(`images/${avatar.id}.png`)?.contentType).toBe('image/png');
    expect(memoryStorage().objects.get(`images/${postImage.id}.jpg`)?.contentType).toBe('image/jpeg');

    // Running again is safe: nothing left to migrate
    expect(await migrateLegacyImages()).toMatchObject({ scanned: 0, migrated: 0 });
  });

  it('relations are untouched and the same URLs keep working after migration', async () => {
    const { owner, avatar, post } = await createLegacyImages();
    await migrateLegacyImages();

    const me = await api().get('/api/auth/me').set('Authorization', owner.auth);
    expect(me.body.user.avatarUrl).toBe(`/api/images/${avatar.id}`);
    const fetchedPost = await api().get(`/api/posts/${post.id}`).set('Authorization', owner.auth);
    expect(fetchedPost.body.post.imageUrl).toMatch(/^\/api\/images\//);

    const res = await api().get(`/api/images/${avatar.id}`).redirects(0);
    expect(res.status).toBe(200); // now served from R2 (proxied by the API, same URL as before)
    expect(Buffer.compare(res.body as Buffer, PNG_IMAGE)).toBe(0);
    // Proof it comes from storage and not from the old database bytes:
    memoryStorage().objects.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await api().get(`/api/images/${avatar.id}`)).status).toBe(404);
  });

  it('a failed upload is reported and the row stays a working legacy image', async () => {
    const { avatar } = await createLegacyImages();
    memoryStorage().failOn('put');
    const result = await migrateLegacyImages();
    expect(result.migrated).toBe(0);
    expect(result.failed).toHaveLength(2);

    const row = await prisma.image.findUniqueOrThrow({ where: { id: avatar.id } });
    expect(row.storageKey).toBeNull();
    const res = await api().get(`/api/images/${avatar.id}`);
    expect(res.status).toBe(200); // still served from PostgreSQL
  });

  it('a corrupted upload (content mismatch) is rejected and cleaned up', async () => {
    await createLegacyImages();
    const storage = memoryStorage();
    const realGet = storage.getObjectBytes.bind(storage);
    storage.getObjectBytes = async (key) => {
      const bytes = await realGet(key);
      return bytes ? Buffer.concat([bytes, Buffer.from('corrupt')]) : null;
    };
    try {
      const result = await migrateLegacyImages();
      expect(result.migrated).toBe(0);
      expect(result.failed[0]?.reason).toMatch(/verification failed/);
      expect(storage.objects.size).toBe(0);
      expect(await prisma.image.count({ where: { storageKey: { not: null } } })).toBe(0);
    } finally {
      storage.getObjectBytes = realGet;
    }
  });
});

describe('Verification, backup and purge', () => {
  it('verify detects a missing object and withdraws its verified status', async () => {
    const { avatar, postImage } = await createLegacyImages();
    await migrateLegacyImages();
    memoryStorage().objects.delete(`images/${avatar.id}.png`);

    const result = await verifyStoredImages();
    expect(result).toMatchObject({ checked: 2, ok: 1 });
    expect(result.problems[0]).toMatchObject({ id: avatar.id, reason: 'object is missing in R2' });
    expect((await prisma.image.findUniqueOrThrow({ where: { id: avatar.id } })).storageVerifiedAt).toBeNull();
    expect((await prisma.image.findUniqueOrThrow({ where: { id: postImage.id } })).storageVerifiedAt).not.toBeNull();
  });

  it('backup writes every legacy image plus a manifest with checksums', async () => {
    await createLegacyImages();
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codenest-backup-'));
    const result = await backupLegacyImages(dir);
    expect(result.count).toBe(2);
    const files = await readdir(dir);
    expect(files.sort()).toHaveLength(3);
    const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.images[0]).toHaveProperty('sha256');
  });

  it('purge without --confirm only reports', async () => {
    await createLegacyImages();
    await migrateLegacyImages();
    const result = await purgeLegacyImageData();
    expect(result).toMatchObject({ candidates: 2, purged: 0, confirm: false });
    expect(await prisma.image.count({ where: { data: { not: null } } })).toBe(2);
  });

  it('purge clears bytes ONLY for verified images whose object still exists', async () => {
    const { avatar, postImage } = await createLegacyImages();
    await migrateLegacyImages();
    memoryStorage().objects.delete(`images/${postImage.id}.jpg`); // disappeared after verification

    const result = await purgeLegacyImageData({ confirm: true });
    expect(result.purged).toBe(1);
    expect(result.skipped).toHaveLength(1);

    const purged = await prisma.image.findUniqueOrThrow({ where: { id: avatar.id } });
    const kept = await prisma.image.findUniqueOrThrow({ where: { id: postImage.id } });
    expect(purged.data).toBeNull();
    expect(kept.data).not.toBeNull(); // still has its database copy
    expect(kept.storageVerifiedAt).toBeNull();
  });

  it('never purges images that were not migrated', async () => {
    await createLegacyImages();
    const result = await purgeLegacyImageData({ confirm: true });
    expect(result).toMatchObject({ candidates: 0, purged: 0, notMigrated: 2 });
  });
});

describe('Orphaned files', () => {
  it('finds and (only with confirm) deletes files that no row points to', async () => {
    const { owner } = await createLegacyImages();
    await migrateLegacyImages();
    await memoryStorage().putObject('images/orphan.png', PNG_IMAGE, 'image/png');

    expect(await findOrphanedObjects({ minAgeMinutes: 0 })).toEqual(['images/orphan.png']);
    // Young files are skipped by default (an upload might be in progress)
    expect(await findOrphanedObjects()).toEqual([]);

    expect((await deleteOrphanedObjects({ minAgeMinutes: 0 })).deleted).toBe(0);
    expect((await deleteOrphanedObjects({ minAgeMinutes: 0, confirm: true })).deleted).toBe(1);
    expect(memoryStorage().objects.has('images/orphan.png')).toBe(false);
    expect(memoryStorage().objects.size).toBe(2); // referenced files untouched
    expect(owner.user.id).toBeGreaterThan(0);
  });
});
