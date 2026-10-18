import type { DownloadTarget, ObjectStorage, StoredObjectInfo } from './types';

type Operation = 'put' | 'delete' | 'head' | 'get' | 'url' | 'list';

/**
 * Keeps objects in RAM. Used by the automated tests (and optionally for local experiments
 * without R2). Not allowed in production — everything is lost on restart.
 */
export class MemoryStorage implements ObjectStorage {
  readonly driver = 'memory' as const;
  readonly objects = new Map<string, { body: Buffer; contentType: string; lastModified: Date }>();
  private failing = new Set<Operation>();
  /** Tests can make the storage behave like R2 with signed URLs. */
  redirectBaseUrl: string | undefined;

  /** Simulate an outage for the given operations (or all of them). */
  failOn(...operations: Operation[]) {
    const all: Operation[] = ['put', 'delete', 'head', 'get', 'url', 'list'];
    for (const op of operations.length ? operations : all) this.failing.add(op);
  }

  reset() {
    this.objects.clear();
    this.failing.clear();
    this.redirectBaseUrl = undefined;
  }

  private check(operation: Operation) {
    if (this.failing.has(operation)) throw new Error(`Simulated storage outage (${operation})`);
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    this.check('put');
    this.objects.set(key, { body: Buffer.from(body), contentType, lastModified: new Date() });
  }

  async deleteObject(key: string) {
    this.check('delete');
    this.objects.delete(key);
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    this.check('head');
    const object = this.objects.get(key);
    return object ? { size: object.body.length, contentType: object.contentType } : null;
  }

  async getObjectBytes(key: string) {
    this.check('get');
    return this.objects.get(key)?.body ?? null;
  }

  async getDownloadTarget(key: string, contentType: string): Promise<DownloadTarget> {
    this.check('url');
    if (this.redirectBaseUrl) {
      return { kind: 'redirect', url: `${this.redirectBaseUrl}/${key}?signature=test`, cacheSeconds: 300, isPublic: false };
    }
    const object = this.objects.get(key);
    if (!object) throw new Error(`Object ${key} does not exist`);
    return { kind: 'bytes', body: object.body, contentType: object.contentType || contentType };
  }

  async listObjects(prefix: string) {
    this.check('list');
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, object]) => ({ key, lastModified: object.lastModified }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }
}
