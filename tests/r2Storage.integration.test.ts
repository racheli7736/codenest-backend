/**
 * Runs the REAL R2Storage class (AWS SDK v3, S3 API) against a real S3-compatible server.
 * Cloudflare R2 speaks the same API. Skipped unless S3_TEST_ENDPOINT is set, e.g.:
 *
 *   docker compose --profile s3 up -d
 *   S3_TEST_ENDPOINT=http://localhost:8333 npm test
 */
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getStorage, setStorageForTests } from '../src/lib/storage';
import { R2Storage } from '../src/lib/storage/r2Storage';
import { migrateLegacyImages, verifyStoredImages } from '../src/modules/images/imageMigration';
import { PNG_IMAGE, api, createUser, prisma, resetDatabase } from './helpers';

const endpoint = process.env.S3_TEST_ENDPOINT;
const credentials = {
  accessKeyId: process.env.S3_TEST_ACCESS_KEY ?? 'codenest',
  secretAccessKey: process.env.S3_TEST_SECRET_KEY ?? 'codenest-local-only',
};
const bucket = `codenest-test-${Date.now()}`;

describe.skipIf(!endpoint)('R2Storage against a real S3-compatible server', () => {
  let storage: R2Storage;
  const original = getStorage();

  beforeAll(async () => {
    const admin = new S3Client({ region: 'auto', endpoint, credentials, forcePathStyle: true });
    await admin.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new R2Storage({ endpoint: endpoint!, ...credentials, bucket, signedUrlTtlSeconds: 300 });
  });

  beforeEach(async () => {
    await resetDatabase();
    setStorageForTests(storage);
  });

  afterAll(() => setStorageForTests(original));

  it('put → head → get → list → delete', async () => {
    const key = 'images/integration-check.png';
    await storage.putObject(key, PNG_IMAGE, 'image/png');

    expect(await storage.headObject(key)).toMatchObject({ size: PNG_IMAGE.length, contentType: 'image/png' });
    expect(Buffer.compare((await storage.getObjectBytes(key))!, PNG_IMAGE)).toBe(0);
    expect((await storage.listObjects('images/')).map((o) => o.key)).toContain(key);

    await storage.deleteObject(key);
    expect(await storage.headObject(key)).toBeNull();
    expect(await storage.getObjectBytes(key)).toBeNull();
    await storage.deleteObject(key); // deleting again is not an error
  });

  it('a signed URL downloads the file without any credentials', async () => {
    const key = 'images/signed-url-check.png';
    await storage.putObject(key, PNG_IMAGE, 'image/png');
    const target = await storage.getDownloadTarget(key);
    expect(target.kind).toBe('redirect');
    if (target.kind !== 'redirect') return;

    const response = await fetch(target.url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(Buffer.compare(Buffer.from(await response.arrayBuffer()), PNG_IMAGE)).toBe(0);

    const tampered = await fetch(target.url.replace(/X-Amz-Signature=[0-9a-f]+/, 'X-Amz-Signature=deadbeef'));
    expect(tampered.status).toBe(403);
  });

  it('end to end through the API: upload → redirect → same bytes; delete removes the object', async () => {
    const me = await createUser();
    const upload = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', PNG_IMAGE, { filename: 'me.png', contentType: 'image/png' });
    expect(upload.status).toBe(200);

    const redirect = await api().get(upload.body.user.avatarUrl).redirects(0);
    expect(redirect.status).toBe(302);
    const file = await fetch(redirect.headers.location as string);
    expect(Buffer.compare(Buffer.from(await file.arrayBuffer()), PNG_IMAGE)).toBe(0);

    const row = await prisma.image.findFirstOrThrow();
    await api().delete('/api/users/me/avatar').set('Authorization', me.auth).expect(204);
    expect(await storage.headObject(row.storageKey!)).toBeNull();
  });

  it('migrates a legacy database image into the bucket and verifies it', async () => {
    const legacy = await prisma.image.create({
      data: { data: new Uint8Array(PNG_IMAGE), mimeType: 'image/png', size: PNG_IMAGE.length },
    });
    expect(await migrateLegacyImages()).toMatchObject({ migrated: 1, failed: [] });
    expect(await verifyStoredImages()).toMatchObject({ checked: 1, ok: 1, problems: [] });
    const info = await storage.headObject(`images/${legacy.id}.png`);
    expect(info?.size).toBe(PNG_IMAGE.length);
  });

  it('a wrong secret key is rejected by the server (and surfaces as 502 in the API)', async () => {
    setStorageForTests(new R2Storage({ endpoint: endpoint!, accessKeyId: credentials.accessKeyId, secretAccessKey: 'wrong', bucket, signedUrlTtlSeconds: 300 }));
    const me = await createUser();
    const res = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', PNG_IMAGE, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(502);
    expect(await prisma.image.count()).toBe(0);
  });

  it('an unreachable endpoint surfaces as 502 (R2 connection failure)', async () => {
    setStorageForTests(new R2Storage({ endpoint: 'http://127.0.0.1:1', ...credentials, bucket, signedUrlTtlSeconds: 300 }));
    const me = await createUser();
    const res = await api()
      .put('/api/users/me/avatar')
      .set('Authorization', me.auth)
      .attach('image', PNG_IMAGE, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_ERROR');
  });
});
