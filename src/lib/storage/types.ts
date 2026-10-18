/** Where the browser should get an image from. */
export type DownloadTarget =
  | { kind: 'redirect'; url: string; cacheSeconds: number; isPublic: boolean }
  | { kind: 'bytes'; body: Buffer; contentType: string };

export interface StoredObjectInfo {
  size: number;
  contentType?: string;
}

/**
 * Object storage used for image files. The production implementation is Cloudflare R2
 * (S3-compatible API). Keys look like "images/<uuid>.<ext>".
 */
export interface ObjectStorage {
  /** Short name for logs and the health check. */
  readonly driver: 'r2' | 'memory' | 'not_configured';
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Deleting a key that does not exist is not an error. */
  deleteObject(key: string): Promise<void>;
  /** null when the object does not exist. */
  headObject(key: string): Promise<StoredObjectInfo | null>;
  /** null when the object does not exist. */
  getObjectBytes(key: string): Promise<Buffer | null>;
  getDownloadTarget(key: string, contentType: string): Promise<DownloadTarget>;
  /** All objects under a prefix (used to find orphaned files). */
  listObjects(prefix: string): Promise<{ key: string; lastModified: Date }[]>;
}
