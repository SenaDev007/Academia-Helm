import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export type StorageType = 'r2' | 's3' | 'vercel-blob' | 'local';

/**
 * StorageService — unified file storage abstraction.
 *
 * Supported backends (via STORAGE_TYPE env var):
 *   - "r2"          : Cloudflare R2 (S3-compatible, custom endpoint, forcePathStyle)
 *   - "s3"          : AWS S3 (standard endpoint, virtual-hosted-style)
 *   - "vercel-blob" : Vercel Blob
 *   - "local"       : Local filesystem (public/ folder) — dev/fallback
 *
 * All cloud backends return publicly-accessible URLs (or presigned URLs for private access).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly storageType: StorageType;
  private readonly blobToken: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const rawType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    this.storageType = rawType as StorageType;
    this.bucketName = this.configService.get<string>('S3_BUCKET') || '';
    this.blobToken = this.configService.get<string>('BLOB_READ_WRITE_TOKEN') || '';
    this.publicUrl = this.configService.get<string>('S3_PUBLIC_URL') || '';

    if (this.storageType === 'r2' || this.storageType === 's3') {
      const endpoint = this.configService.get<string>('S3_ENDPOINT');
      const region = this.configService.get<string>('S3_REGION') || 'auto';
      const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') || '';
      const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '';

      const clientConfig: any = {
        region,
        credentials: { accessKeyId, secretAccessKey },
      };

      // R2 requires a custom endpoint and forcePathStyle
      if (this.storageType === 'r2' && endpoint) {
        clientConfig.endpoint = endpoint;
        clientConfig.forcePathStyle = true;
      }

      this.s3Client = new S3Client(clientConfig);
      this.logger.log(`Storage initialized: ${this.storageType.toUpperCase()} (bucket: ${this.bucketName})`);
    } else if (this.storageType === 'vercel-blob') {
      if (!this.blobToken) {
        this.logger.error('BLOB_READ_WRITE_TOKEN is not set! Vercel Blob storage will not work.');
      }
      this.logger.log('Storage initialized: Vercel Blob');
    } else {
      this.logger.log('Storage initialized: Local filesystem (public/)');
    }
  }

  // ─── Upload ─────────────────────────────────────────────────────────────

  /**
   * Upload a file and return its storage path/URL.
   *
   * For R2/S3: the returned value is the object key (e.g. "candidate-docs/tenantId/candidateId/cv/uuid-file.pdf").
   * For Vercel Blob: returns the full public URL.
   * For local: returns the relative path (e.g. "/uploads/uuid-file.pdf").
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    const fileName = `${uuidv4()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    // ─── Vercel Blob ───────────────────────────────────────────────────────
    if (this.storageType === 'vercel-blob') {
      try {
        const blob = await put(key, file.buffer, {
          access: 'public',
          contentType: file.mimetype,
          token: this.blobToken,
        });
        this.logger.log(`Vercel Blob upload: ${blob.url}`);
        return blob.url;
      } catch (error) {
        this.logger.error(`Vercel Blob Upload Error: ${error.message}`);
        throw error;
      }
    }

    // ─── R2 / S3 ──────────────────────────────────────────────────────────
    if ((this.storageType === 'r2' || this.storageType === 's3') && this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        this.logger.log(`${this.storageType.toUpperCase()} upload: ${key}`);
        return key;
      } catch (error) {
        this.logger.error(`${this.storageType.toUpperCase()} Upload Error: ${error.message}`);
        throw error;
      }
    }

    // ─── Local Storage Fallback ────────────────────────────────────────────
    const uploadPath = path.join(process.cwd(), 'public', folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    const filePath = path.join(uploadPath, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${folder}/${fileName}`;
  }

  // ─── Upload Buffer (for generated PDFs, etc.) ─────────────────────────

  /**
   * Upload a raw Buffer to storage and return its storage path/URL.
   * Used by PDF generation services (contracts, pay slips) to persist
   * generated documents to cloud storage (R2/S3) instead of the ephemeral
   * local filesystem.
   *
   * @param buffer  - The file content as a Buffer
   * @param key     - The full storage key (e.g. "contracts/tenantId/contract-xxx.pdf")
   * @param contentType - MIME type (default: application/pdf)
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf',
  ): Promise<string> {
    // ─── Vercel Blob ───────────────────────────────────────────────────────
    if (this.storageType === 'vercel-blob') {
      try {
        const blob = await put(key, buffer, {
          access: 'public',
          contentType,
          token: this.blobToken,
        });
        this.logger.log(`Vercel Blob upload: ${blob.url}`);
        return blob.url;
      } catch (error) {
        this.logger.error(`Vercel Blob Upload Error: ${error.message}`);
        throw error;
      }
    }

    // ─── R2 / S3 ──────────────────────────────────────────────────────────
    if ((this.storageType === 'r2' || this.storageType === 's3') && this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          }),
        );
        this.logger.log(`${this.storageType.toUpperCase()} upload: ${key}`);
        return key;
      } catch (error) {
        this.logger.error(`${this.storageType.toUpperCase()} Upload Error: ${error.message}`);
        throw error;
      }
    }

    // ─── Local Storage Fallback ────────────────────────────────────────────
    const dir = path.join(process.cwd(), 'public', path.dirname(key));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(process.cwd(), 'public', key);
    fs.writeFileSync(filePath, buffer);
    return `/${key}`;
  }

  // ─── Download ───────────────────────────────────────────────────────────

  /**
   * Download a file as a Buffer.
   * Works for R2/S3 (via GetObject) and local files.
   * For Vercel Blob or public URLs, use resolveFileUrl() instead.
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    // ─── R2 / S3 ──────────────────────────────────────────────────────────
    if ((this.storageType === 'r2' || this.storageType === 's3') && this.s3Client) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
          }),
        );
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (error) {
        this.logger.error(`${this.storageType.toUpperCase()} Download Error: ${error.message}`);
        throw error;
      }
    }

    // ─── Local ────────────────────────────────────────────────────────────
    const localPath = path.join(process.cwd(), 'public', filePath);
    if (!fs.existsSync(localPath)) {
      throw new Error(`File not found: ${localPath}`);
    }
    return fs.readFileSync(localPath);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  /**
   * Delete a file from storage.
   * For R2/S3: deletes by object key.
   * For Vercel Blob: not supported via key (needs full URL).
   * For local: deletes the file from disk.
   */
  async deleteFile(filePath: string): Promise<void> {
    // ─── R2 / S3 ──────────────────────────────────────────────────────────
    if ((this.storageType === 'r2' || this.storageType === 's3') && this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
          }),
        );
        this.logger.log(`${this.storageType.toUpperCase()} deleted: ${filePath}`);
      } catch (error) {
        this.logger.error(`${this.storageType.toUpperCase()} Delete Error: ${error.message}`);
        throw error;
      }
      return;
    }

    // ─── Vercel Blob ──────────────────────────────────────────────────────
    if (this.storageType === 'vercel-blob' && filePath.startsWith('https://')) {
      try {
        // Vercel Blob deletion requires the full URL
        const { del } = await import('@vercel/blob');
        await del(filePath, { token: this.blobToken });
        this.logger.log(`Vercel Blob deleted: ${filePath}`);
      } catch (error) {
        this.logger.error(`Vercel Blob Delete Error: ${error.message}`);
        // Non-fatal — don't throw
      }
      return;
    }

    // ─── Local ────────────────────────────────────────────────────────────
    const localPath = path.join(process.cwd(), 'public', filePath);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      this.logger.log(`Local file deleted: ${localPath}`);
    }
  }

  // ─── Presigned URL ─────────────────────────────────────────────────────

  /**
   * Generate a presigned URL for temporary access to a private file.
   * Only works for R2/S3 backends.
   */
  async getPresignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client) {
      throw new Error('Presigned URLs are only available for R2/S3 storage backends');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  // ─── Resolve URL ───────────────────────────────────────────────────────

  /**
   * Resolve a file path to a fully accessible URL.
   *
   * For R2 with S3_PUBLIC_URL: returns `publicUrl/key`
   * For R2 without S3_PUBLIC_URL: returns a presigned URL (7 days)
   * For S3: returns standard S3 URL
   * For Vercel Blob: returns the URL as-is
   * For local: returns the relative path
   */
  async resolveFileUrl(filePath: string): Promise<string> {
    if (!filePath) return '';

    // Already a full URL (Vercel Blob, external URL, etc.)
    if (filePath.startsWith('https://') || filePath.startsWith('http://')) {
      return filePath;
    }

    // Local relative path
    if (filePath.startsWith('/')) {
      return filePath;
    }

    // R2 with configured public URL
    if (this.storageType === 'r2' && this.publicUrl) {
      return `${this.publicUrl}/${filePath}`;
    }

    // R2/S3 — generate presigned URL
    if ((this.storageType === 'r2' || this.storageType === 's3') && this.s3Client) {
      return this.getPresignedUrl(filePath, 7 * 24 * 3600); // 7 days
    }

    // Fallback: return as-is
    return filePath;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Returns true if the storage mode serves publicly accessible URLs
   * (i.e., no need for a download proxy endpoint).
   */
  isPublicUrlMode(): boolean {
    return this.storageType === 'vercel-blob' || this.storageType === 's3';
  }

  /**
   * Returns the current storage type.
   */
  getStorageType(): StorageType {
    return this.storageType;
  }

  /**
   * Delete ALL objects under a given prefix in R2/S3.
   * Used for cleanup of orphaned files (e.g., when candidates are deleted
   * directly from the DB without going through the API).
   *
   * Returns the list of deleted keys.
   */
  async deleteByPrefix(prefix: string): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('deleteByPrefix is only available for R2/S3 storage backends');
    }

    const deletedKeys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );

      const objects = listResponse.Contents || [];
      if (objects.length === 0) {
        this.logger.log(`No objects found under prefix: ${prefix}`);
        break;
      }

      // Delete in batches of 1000
      const keys = objects.map((o) => o.Key!).filter(Boolean);
      if (keys.length > 0) {
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
              Objects: keys.map((k) => ({ Key: k })),
              Quiet: true,
            },
          }),
        );
        deletedKeys.push(...keys);
        this.logger.log(`Deleted ${keys.length} objects under prefix: ${prefix}`);
      }

      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return deletedKeys;
  }

  /**
   * List all object keys under a given prefix in R2/S3.
   */
  async listByPrefix(prefix: string): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('listByPrefix is only available for R2/S3 storage backends');
    }

    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );

      const objects = listResponse.Contents || [];
      keys.push(...objects.map((o) => o.Key!).filter(Boolean));

      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }
}
