import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const WEBP_QUALITY = 82;

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  /**
   * Redimensionne (fit inside), supprime métadonnées EXIF, encode WebP.
   * Entrée : data URL `data:image/...;base64,...`
   */
  async optimizeDataUrl(dataUrl: string): Promise<{
    dataUrl: string;
    mimeType: string;
    bytesBefore: number;
    bytesAfter: number;
  }> {
    const trimmed = (dataUrl ?? '').trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:image/...;base64,...).');
    }
    const inputMime = m[1].trim().toLowerCase();
    if (!inputMime.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > MAX_INPUT_BYTES) {
      throw new BadRequestException(
        `Image trop volumineuse (max ${Math.round(MAX_INPUT_BYTES / (1024 * 1024))} Mo décodés).`,
      );
    }

    const bytesBefore = buffer.length;

    try {
      const pipeline = sharp(buffer, { failOn: 'truncated' })
        .rotate()
        .resize(DEFAULT_MAX_EDGE, DEFAULT_MAX_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 4 });

      const out = await pipeline.toBuffer();
      const bytesAfter = out.length;
      const outDataUrl = `data:image/webp;base64,${out.toString('base64')}`;

      return {
        dataUrl: outDataUrl,
        mimeType: 'image/webp',
        bytesBefore,
        bytesAfter,
      };
    } catch (e) {
      this.logger.warn(`optimizeDataUrl: ${e instanceof Error ? e.message : String(e)}`);
      throw new BadRequestException(
        'Impossible de traiter cette image (format non supporté ou fichier corrompu).',
      );
    }
  }
}
