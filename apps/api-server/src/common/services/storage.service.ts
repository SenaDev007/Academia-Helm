import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly useS3: boolean;

  constructor(private readonly configService: ConfigService) {
    this.useS3 = this.configService.get<string>('STORAGE_TYPE') === 's3';
    this.bucketName = this.configService.get<string>('S3_BUCKET') || '';

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('S3_REGION'),
        credentials: {
          accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || '',
          secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '',
        },
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    const fileName = `${uuidv4()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    if (this.useS3 && this.s3Client) {
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
    } else {
      // Local Storage Fallback
      const uploadPath = path.join(process.cwd(), 'public', folder);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      const filePath = path.join(uploadPath, fileName);
      fs.writeFileSync(filePath, file.buffer);
      return `/${folder}/${fileName}`;
    }
  }
}
