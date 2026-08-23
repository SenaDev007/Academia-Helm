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

    // ⭐ FIX: read from BOTH R2_* and S3_* env vars.
    //    The user has configured R2_* env vars on Railway (R2_ACCESS_KEY_ID,
    //    R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCOUNT_ID).
    //    Previously, only S3_* env vars were read — so when STORAGE_TYPE=r2
    //    was set with R2_* vars, all the R2 config was empty and the S3Client
    //    was constructed with empty credentials. The actual upload would
    //    silently fail OR succeed but return a relative key (not a URL).
    //    Now: when storageType === 'r2', R2_* vars take precedence, falling
    //    back to S3_* for backwards compatibility.
    const isR2 = rawType === 'r2';
    const bucketVar = isR2 ? 'R2_BUCKET_NAME' : 'S3_BUCKET';
    const publicUrlVar = isR2 ? 'R2_PUBLIC_URL' : 'S3_PUBLIC_URL';
    const endpointVar = isR2 ? 'R2_ENDPOINT' : 'S3_ENDPOINT';
    const regionVar = isR2 ? 'R2_REGION' : 'S3_REGION';
    const accessKeyVar = isR2 ? 'R2_ACCESS_KEY_ID' : 'S3_ACCESS_KEY_ID';
    const secretKeyVar = isR2 ? 'R2_SECRET_ACCESS_KEY' : 'S3_SECRET_ACCESS_KEY';

    this.bucketName =
      this.configService.get<string>(bucketVar) ||
      this.configService.get<string>('S3_BUCKET') ||  // fallback
      '';
    this.blobToken = this.configService.get<string>('BLOB_READ_WRITE_TOKEN') || '';
    this.publicUrl =
      this.configService.get<string>(publicUrlVar) ||
      this.configService.get<string>('S3_PUBLIC_URL') ||  // fallback
      '';

    if (this.storageType === 'r2' || this.storageType === 's3') {
      const endpoint =
        this.configService.get<string>(endpointVar) ||
        this.configService.get<string>('S3_ENDPOINT') ||  // fallback
        '';
      const region =
        this.configService.get<string>(regionVar) ||
        this.configService.get<string>('S3_REGION') ||
        'auto';
      const accessKeyId =
        this.configService.get<string>(accessKeyVar) ||
        this.configService.get<string>('S3_ACCESS_KEY_ID') ||  // fallback
        '';
      const secretAccessKey =
        this.configService.get<string>(secretKeyVar) ||
        this.configService.get<string>('S3_SECRET_ACCESS_KEY') ||  // fallback
        '';

      // ⭐ Log a clear warning if required R2 config is missing — helps debug
      //    silent upload failures that produce relative-path URLs instead
      //    of full https URLs.
      if (!accessKeyId || !secretAccessKey || !this.bucketName) {
        this.logger.error(
          `⚠️  Storage config incomplete for ${this.storageType.toUpperCase()}: ` +
          `${accessKeyVar}=${accessKeyId ? '✓' : '✗'} ` +
          `${secretKeyVar}=${secretAccessKey ? '✓' : '✗'} ` +
          `${bucketVar}=${this.bucketName ? '✓' : '✗'}. ` +
          `Uploads will fail silently and fall back to local storage.`
        );
      }

      // ⭐ R2 endpoint: either explicit (R2_ENDPOINT) or derived from
      //    R2_ACCOUNT_ID (https://<account_id>.r2.cloudflarestorage.com).
      //    The user typically has R2_ACCOUNT_ID set, not R2_ENDPOINT.
      let resolvedEndpoint = endpoint;
      if (this.storageType === 'r2' && !resolvedEndpoint) {
        const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
        if (accountId) {
          resolvedEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        }
      }

      const clientConfig: any = {
        region,
        credentials: { accessKeyId, secretAccessKey },
      };

      // R2 requires a custom endpoint and forcePathStyle
      if (this.storageType === 'r2' && resolvedEndpoint) {
        clientConfig.endpoint = resolvedEndpoint;
        clientConfig.forcePathStyle = true;
      }

      this.s3Client = new S3Client(clientConfig);
      this.logger.log(
        `Storage initialized: ${this.storageType.toUpperCase()} ` +
        `(bucket: ${this.bucketName}, publicUrl: ${this.publicUrl || 'NOT SET'})`
      );
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
        // ⭐ FIX: return the FULL public URL (https://...) so the frontend
        //    can use it directly in <audio src> / <img src> / <a href download>.
        //    Previously returned just the key (e.g. 'chat/audio/uuid.webm')
        //    which the frontend had to prepend a backend URL to — but that
        //    only works for local-storage URLs, not R2.
        const publicFileUrl = this.publicUrl
          ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
          : key;
        this.logger.log(`${this.storageType.toUpperCase()} upload: ${key} → ${publicFileUrl}`);
        return publicFileUrl;
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
        // ⭐ FIX: return the FULL public URL (https://...) — see uploadFile above.
        const publicFileUrl = this.publicUrl
          ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
          : key;
        this.logger.log(`${this.storageType.toUpperCase()} upload: ${key} → ${publicFileUrl}`);
        return publicFileUrl;
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
    // ─── Data URL (base64 inline) — décoder directement ───────────────────
    if (filePath.startsWith('data:')) {
      const m = /^data:[^;]+;base64,(.+)$/i.exec(filePath);
      if (m) return Buffer.from(m[1], 'base64');
      throw new Error('Invalid data URL format');
    }

    // ─── HTTPS URL — fetch ────────────────────────────────────────────────
    if (filePath.startsWith('https://') || filePath.startsWith('http://')) {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${filePath}`);
      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

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

    // Data URL (base64 inline) — retourner tel quel, utilisable directement dans <img src>
    if (filePath.startsWith('data:')) {
      return filePath;
    }

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

  // ─── Health-check au démarrage ─────────────────────────────────────────────

  /**
   * Vérifie que le backend R2/S3 est accessible et que les credentials sont valides.
   * Non-bloquant : utilisé dans le constructeur pour logger un warning si KO.
   *
   * Effectue un PutObject + DeleteObject sur un fichier test (_healthcheck.txt).
   * Coût : ~2 requêtes S3 par démarrage — négligeable.
   */
  private async runHealthCheck(): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const testKey = '_healthcheck.txt';
    const testBody = Buffer.from(`Academia Helm storage health-check @ ${new Date().toISOString()}`);

    // 1. PutObject — vérifie permissions d'écriture
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: testBody,
        ContentType: 'text/plain',
      }),
    );

    // 2. DeleteObject — cleanup
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: testKey,
        }),
      );
    } catch {
      // Non-fatal — le test a réussi même si cleanup échoue
    }

    this.logger.log(
      `✅ Storage health-check passed: ${this.storageType.toUpperCase()} is ready ` +
      `(bucket=${this.bucketName}, publicUrl=${this.publicUrl || '(presigned only)'})`,
    );
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
