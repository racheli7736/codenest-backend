/**
 * Safe, repeatable tools for moving legacy images (bytes in PostgreSQL) to Cloudflare R2.
 *
 * Order of operations (each step can be run again safely):
 *   1. backupLegacyImages      – copy every legacy image to a local folder (+ manifest with SHA-256).
 *   2. migrateLegacyImages     – upload to R2, read it back, compare, and only then save the key.
 *                                The bytes in PostgreSQL are KEPT.
 *   3. verifyStoredImages      – re-check every R2 object referenced by the database.
 *   4. purgeLegacyImageData    – (needs confirm) clear the old bytes, only for verified rows.
 *   +  findOrphanedObjects / deleteOrphanedObjects – files in R2 that no row points to.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma';
import { getStorage, type ObjectStorage } from '../../lib/storage';
import { buildStorageKey } from './images.service';

type Log = (message: string) => void;
const silent: Log = () => undefined;

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

interface Options {
  storage?: ObjectStorage;
  log?: Log;
  batchSize?: number;
}

export interface Problem {
  id: string;
  key?: string | null;
  reason: string;
}

/** Copies every image that still has bytes in PostgreSQL to a local folder. */
export async function backupLegacyImages(outDir: string, { log = silent, batchSize = 50 }: Options = {}) {
  await mkdir(outDir, { recursive: true });
  const manifest: { id: string; file: string; mimeType: string; size: number; sha256: string }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.image.findMany({
      where: { data: { not: null } },
      select: { id: true, data: true, mimeType: true, size: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (!row.data) continue;
      const file = path.basename(buildStorageKey(row.id, row.mimeType));
      await writeFile(path.join(outDir, file), row.data);
      manifest.push({ id: row.id, file, mimeType: row.mimeType, size: row.data.length, sha256: sha256(row.data) });
      log(`  backed up ${row.id}`);
    }
    cursor = rows.at(-1)?.id;
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ createdAt: new Date(), images: manifest }, null, 2));
  return { count: manifest.length, outDir };
}

/**
 * Uploads every legacy image to R2, downloads it again and compares SHA-256.
 * Only a verified upload is recorded in the database. Legacy bytes are never deleted here.
 */
export async function migrateLegacyImages({
  storage = getStorage(),
  log = silent,
  batchSize = 20,
  dryRun = false,
}: Options & { dryRun?: boolean } = {}) {
  const result = { scanned: 0, migrated: 0, dryRun, failed: [] as Problem[] };
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.image.findMany({
      where: { storageKey: null, data: { not: null } },
      select: { id: true, data: true, mimeType: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows.at(-1)?.id;

    for (const row of rows) {
      result.scanned += 1;
      if (!row.data) continue;
      const key = buildStorageKey(row.id, row.mimeType);
      if (dryRun) {
        log(`  [dry-run] would upload ${row.id} → ${key} (${row.data.length} bytes)`);
        continue;
      }
      try {
        const original = Buffer.from(row.data);
        await storage.putObject(key, original, row.mimeType);
        const copy = await storage.getObjectBytes(key);
        if (!copy || copy.length !== original.length || sha256(copy) !== sha256(original)) {
          await storage.deleteObject(key).catch(() => undefined);
          throw new Error('verification failed: the object in R2 does not match the database bytes');
        }
        // Only now does the database point to R2. "data" stays as a backup until the purge step.
        await prisma.image.update({
          where: { id: row.id },
          data: { storageKey: key, storageVerifiedAt: new Date() },
        });
        result.migrated += 1;
        log(`  ✔ ${row.id} → ${key}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        result.failed.push({ id: row.id, key, reason });
        log(`  ✖ ${row.id}: ${reason}`);
      }
    }
  }
  return result;
}

/**
 * Checks that every R2 object referenced by the database exists with the right size
 * (and, while legacy bytes still exist, the same content). Updates storage_verified_at.
 */
export async function verifyStoredImages({ storage = getStorage(), log = silent, batchSize = 50 }: Options = {}) {
  const result = { checked: 0, ok: 0, problems: [] as Problem[] };
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.image.findMany({
      where: { storageKey: { not: null } },
      select: { id: true, storageKey: true, size: true, data: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows.at(-1)?.id;

    for (const row of rows) {
      result.checked += 1;
      const key = row.storageKey as string;
      let reason: string | null = null;
      try {
        const info = await storage.headObject(key);
        if (!info) reason = 'object is missing in R2';
        else if (info.size !== row.size) reason = `size mismatch (db ${row.size}, R2 ${info.size})`;
        else if (row.data) {
          const copy = await storage.getObjectBytes(key);
          if (!copy || sha256(copy) !== sha256(row.data)) reason = 'content differs from the database copy';
        }
      } catch (error) {
        reason = `could not reach storage: ${error instanceof Error ? error.message : String(error)}`;
      }

      if (reason) {
        result.problems.push({ id: row.id, key, reason });
        // Not verified anymore → the purge step will not touch this row.
        await prisma.image.update({ where: { id: row.id }, data: { storageVerifiedAt: null } });
        log(`  ✖ ${row.id}: ${reason}`);
      } else {
        result.ok += 1;
        await prisma.image.update({ where: { id: row.id }, data: { storageVerifiedAt: new Date() } });
      }
    }
  }
  return result;
}

/**
 * Clears legacy bytes from PostgreSQL — ONLY for rows whose R2 copy is verified, and only
 * after re-checking the object right now. Without `confirm` it just reports what it would do.
 */
export async function purgeLegacyImageData({
  storage = getStorage(),
  log = silent,
  confirm = false,
}: Options & { confirm?: boolean } = {}) {
  const candidates = await prisma.image.findMany({
    where: { data: { not: null }, storageKey: { not: null }, storageVerifiedAt: { not: null } },
    select: { id: true, storageKey: true, size: true },
    orderBy: { id: 'asc' },
  });
  const notMigrated = await prisma.image.count({ where: { data: { not: null }, storageVerifiedAt: null } });
  const result = { candidates: candidates.length, purged: 0, skipped: [] as Problem[], notMigrated, confirm };
  if (!confirm) {
    log(`  [dry-run] ${candidates.length} image(s) would be cleared. Run again with --confirm to do it.`);
    return result;
  }
  for (const row of candidates) {
    const info = await storage.headObject(row.storageKey as string).catch(() => null);
    if (!info || info.size !== row.size) {
      result.skipped.push({ id: row.id, key: row.storageKey, reason: 'R2 object missing or wrong size right now' });
      await prisma.image.update({ where: { id: row.id }, data: { storageVerifiedAt: null } });
      continue;
    }
    await prisma.image.update({ where: { id: row.id }, data: { data: null } });
    result.purged += 1;
    log(`  ✔ cleared database bytes of ${row.id}`);
  }
  return result;
}

/**
 * Files under images/ in R2 that no database row points to (e.g. after an R2 outage during delete).
 * Files younger than `minAgeMinutes` are ignored: an upload in progress briefly has a file but no row yet.
 */
export async function findOrphanedObjects({
  storage = getStorage(),
  minAgeMinutes = 60,
}: Options & { minAgeMinutes?: number } = {}) {
  const cutoff = Date.now() - minAgeMinutes * 60_000;
  const keys = (await storage.listObjects('images/'))
    .filter((object) => object.lastModified.getTime() <= cutoff)
    .map((object) => object.key);
  if (keys.length === 0) return [];
  const known = new Set(
    (await prisma.image.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } })).map(
      (row) => row.storageKey,
    ),
  );
  return keys.filter((key) => !known.has(key));
}

export async function deleteOrphanedObjects({
  storage = getStorage(),
  log = silent,
  confirm = false,
  minAgeMinutes = 60,
}: Options & { confirm?: boolean; minAgeMinutes?: number } = {}) {
  const orphans = await findOrphanedObjects({ storage, minAgeMinutes });
  if (!confirm) {
    for (const key of orphans) log(`  [dry-run] orphan: ${key}`);
    return { orphans, deleted: 0, confirm };
  }
  let deleted = 0;
  for (const key of orphans) {
    // Re-check right before deleting, in case an upload linked it in the meantime.
    const stillOrphan = (await prisma.image.count({ where: { storageKey: key } })) === 0;
    if (!stillOrphan) continue;
    await storage.deleteObject(key);
    deleted += 1;
    log(`  ✔ deleted ${key}`);
  }
  return { orphans, deleted, confirm };
}
