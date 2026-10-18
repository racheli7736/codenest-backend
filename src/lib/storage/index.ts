import { env, r2Config } from '../../config/env';
import { HttpError } from '../../utils/httpError';
import { MemoryStorage } from './memoryStorage';
import { R2Storage } from './r2Storage';
import type { ObjectStorage } from './types';

export type { DownloadTarget, ObjectStorage, StoredObjectInfo } from './types';
export { MemoryStorage } from './memoryStorage';
export { R2Storage } from './r2Storage';

/** Used when R2 credentials are missing: reading legacy images still works, uploads answer 503. */
export class NotConfiguredStorage implements ObjectStorage {
  readonly driver = 'not_configured' as const;
  private fail(): never {
    throw new HttpError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'Image storage is not configured on the server (missing Cloudflare R2 settings)',
    );
  }
  putObject(): Promise<void> { this.fail(); }
  deleteObject(): Promise<void> { this.fail(); }
  headObject(): Promise<null> { this.fail(); }
  getObjectBytes(): Promise<null> { this.fail(); }
  getDownloadTarget(): Promise<never> { this.fail(); }
  listObjects(): Promise<never[]> { this.fail(); }
}

function createStorage(): ObjectStorage {
  if (env.STORAGE_DRIVER === 'memory') return new MemoryStorage();
  if (!r2Config) {
    if (env.NODE_ENV !== 'test') {
      console.warn('⚠ Cloudflare R2 is not configured (R2_* variables). Image uploads will answer 503.');
    }
    return new NotConfiguredStorage();
  }
  return new R2Storage({ ...r2Config, signedUrlTtlSeconds: env.IMAGE_URL_TTL_SECONDS });
}

let storage: ObjectStorage | undefined;

/** The storage the whole app uses (created on first use). */
export function getStorage(): ObjectStorage {
  storage ??= createStorage();
  return storage;
}

/** Tests only: swap the storage implementation. */
export function setStorageForTests(replacement: ObjectStorage | undefined) {
  storage = replacement;
}
