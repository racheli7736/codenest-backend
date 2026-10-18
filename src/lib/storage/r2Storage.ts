import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { DownloadTarget, ObjectStorage, StoredObjectInfo } from './types';

export interface R2Settings {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public bucket URL / custom domain; when set, no signed URLs are needed. */
  publicBaseUrl?: string;
  /** Lifetime of signed URLs. */
  signedUrlTtlSeconds: number;
}

function isNotFound(error: unknown) {
  return (
    error instanceof NotFound ||
    error instanceof NoSuchKey ||
    (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
  );
}

/** Cloudflare R2 through its S3-compatible API. Credentials stay on the server only. */
export class R2Storage implements ObjectStorage {
  readonly driver = 'r2' as const;
  private readonly client: S3Client;

  constructor(private readonly settings: R2Settings) {
    this.client = new S3Client({
      region: 'auto', // R2 ignores regions; "auto" is what Cloudflare documents
      endpoint: settings.endpoint,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      forcePathStyle: true,
      // Only send/validate checksums when an operation requires them (recommended for R2).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
    });
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        // A key never gets new content (a new upload gets a new key), so caching forever is safe.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }));
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }));
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getObjectBytes(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getDownloadTarget(key: string): Promise<DownloadTarget> {
    if (this.settings.publicBaseUrl) {
      return {
        kind: 'redirect',
        url: `${this.settings.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`,
        cacheSeconds: 86400,
        isPublic: true,
      };
    }
    const ttl = this.settings.signedUrlTtlSeconds;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      { expiresIn: ttl },
    );
    // The redirect itself may be cached, but never longer than the signed URL lives.
    return { kind: 'redirect', url, cacheSeconds: Math.max(0, Math.min(ttl - 60, 1800)), isPublic: false };
  }

  async listObjects(prefix: string) {
    const objects: { key: string; lastModified: Date }[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.settings.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const item of page.Contents ?? []) {
        if (item.Key) objects.push({ key: item.Key, lastModified: item.LastModified ?? new Date(0) });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return objects;
  }
}
