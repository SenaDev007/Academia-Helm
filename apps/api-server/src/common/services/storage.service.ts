import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export type StorageType = 's3' | 'vercel-blob' | 'local';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly storageType: StorageType;
  private readonly blobToken: string;

  constructor(private readonly configService: ConfigService) {
    const rawType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    this.storageType = rawType as StorageType;
    this.bucketName = this.configService.get<string>('S3_BUCKET') || '';
    this.blobToken = this.configService.get<string>('BLOB_READ_WRITE_TOKEN') || '';

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('S3_REGION'),
        credentials: {
          accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || '',
          secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '',
        },
      });
      this.logger.log('Storage initialized: AWS S3');
    } else if (this.storageType === 'vercel-blob') {
      if (!this.blobToken) {
        this.logger.error('BLOB_READ_WRITE_TOKEN is not set! Vercel Blob storage will not work.');
      }
      this.logger.log('Storage initialized: Vercel Blob');
    } else {
      this.logger.log('Storage initialized: Local filesystem (public/)');
    }
  }

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

    // ─── AWS S3 ────────────────────────────────────────────────────────────
    if (this.storageType === 's3' && this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read',
          }),
        );
        return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      } catch (error) {
        this.logger.error(`S3 Upload Error: ${error.message}`);
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

  /**
   * Returns true if the storage mode serves publicly accessible URLs
   * (i.e., no need for a download proxy endpoint).
   */
  isPublicUrlMode(): boolean {
    return this.storageType === 'vercel-blob' || this.storageType === 's3';
  }
}
