/**
 * ============================================================================
 * DATA URL VALIDATION PIPE — Pattern standard Helm pour tous les uploads
 * ============================================================================
 *
 * Valide et parse automatiquement un data URL (base64) dans le body d'une
 * requête. Centralise la logique de validation qui était dupliquée dans
 * chaque contrôleur d'upload.
 *
 * Usage:
 *   @Post('upload-photo')
 *   async uploadPhoto(@Body('photoDataUrl', DataUrlValidationPipe) dataUrl: string) {
 *     // dataUrl est validé et utilisable directement
 *   }
 *
 *   @Post('upload-document')
 *   async uploadDocument(
 *     @Body('fileDataUrl', new DataUrlValidationPipe({ allowedMimeTypes: ['image/jpeg', 'application/pdf'] })) dataUrl: string,
 *   ) { ... }
 *
 * Le pipe:
 *   1. Vérifie que la valeur est une string non vide
 *   2. Valide le format data:...;base64,...
 *   3. Extrait le mimeType et le buffer décodé
 *   4. Valide le mimeType contre allowedMimeTypes (si fourni)
 *   5. Valide la taille (maxBytes, défaut 20 Mo)
 *   6. Retourne la data URL string (utilisable directement dans <img src>)
 *
 * Pour récupérer le Buffer décodé, utiliser DataUrlHelper.decode(dataUrl).
 * ============================================================================
 */

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface DataUrlValidationOptions {
  /** MIME types autorisés (ex: ['image/jpeg', 'image/png', 'application/pdf']). Si omis, tous les types sont acceptés. */
  allowedMimeTypes?: string[];
  /** Taille max en bytes (défaut: 20 Mo) */
  maxBytes?: number;
  /** Nom du champ pour les messages d'erreur (ex: 'photoDataUrl') */
  fieldName?: string;
}

export interface ParsedDataUrl {
  /** La data URL complète (data:...;base64,...) */
  dataUrl: string;
  /** Le MIME type extrait (ex: 'image/jpeg') */
  mimeType: string;
  /** Le buffer décodé */
  buffer: Buffer;
  /** La taille en bytes */
  size: number;
}

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 Mo
const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/i;

/**
 * Helper utilitaire pour décoder une data URL en buffer.
 */
export class DataUrlHelper {
  static decode(dataUrl: string): ParsedDataUrl | null {
    const trimmed = (dataUrl ?? '').trim();
    const m = DATA_URL_REGEX.exec(trimmed);
    if (!m) return null;
    const mimeType = m[1].trim().toLowerCase();
    try {
      const buffer = Buffer.from(m[2], 'base64');
      return { dataUrl: trimmed, mimeType, buffer, size: buffer.length };
    } catch {
      return null;
    }
  }

  static isDataUrl(value: string): boolean {
    return typeof value === 'string' && DATA_URL_REGEX.test(value.trim());
  }
}

/**
 * Pipe NestJS qui valide une data URL (base64) dans le body.
 *
 * @example
 * // Validation simple (tous types, 20 Mo max)
 * @Body('photoDataUrl', DataUrlValidationPipe) dataUrl: string
 *
 * @example
 * // Validation avec restrictions
 * @Body('fileDataUrl', new DataUrlValidationPipe({
 *   allowedMimeTypes: ['image/jpeg', 'image/png'],
 *   maxBytes: 5 * 1024 * 1024, // 5 Mo
 *   fieldName: 'photo',
 * })) dataUrl: string
 */
@Injectable()
export class DataUrlValidationPipe implements PipeTransform {
  constructor(private readonly options: DataUrlValidationOptions = {}) {}

  transform(value: any): string {
    const fieldName = this.options.fieldName || 'dataUrl';

    // 1. Vérifier que c'est une string non vide
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} requis (data URL base64)`);
    }

    // 2. Valider le format data:...;base64,...
    const parsed = DataUrlHelper.decode(value);
    if (!parsed) {
      throw new BadRequestException(
        `${fieldName}: format attendu data URL base64 (data:image/...;base64,...)`,
      );
    }

    // 3. Valider le mimeType contre allowedMimeTypes
    if (this.options.allowedMimeTypes && this.options.allowedMimeTypes.length > 0) {
      if (!this.options.allowedMimeTypes.includes(parsed.mimeType)) {
        throw new BadRequestException(
          `${fieldName}: format non supporté '${parsed.mimeType}'. Formats acceptés: ${this.options.allowedMimeTypes.join(', ')}`,
        );
      }
    }

    // 4. Valider la taille
    const maxBytes = this.options.maxBytes ?? DEFAULT_MAX_BYTES;
    if (parsed.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      const sizeMB = (parsed.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `${fieldName}: fichier trop volumineux (${sizeMB} Mo, max ${maxMB} Mo)`,
      );
    }

    // 5. Retourner la data URL string (le contrôleur peut utiliser DataUrlHelper.decode pour le buffer)
    return parsed.dataUrl;
  }
}

/**
 * Pipes pré-configurés pour les cas courants.
 *
 * @example
 * @Body('photoDataUrl', IMAGE_ONLY_DATA_URL_PIPE) dataUrl: string
 */
export const IMAGE_ONLY_DATA_URL_PIPE = new DataUrlValidationPipe({
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  maxBytes: 5 * 1024 * 1024, // 5 Mo
  fieldName: 'photoDataUrl',
});

export const IMAGE_OR_PDF_DATA_URL_PIPE = new DataUrlValidationPipe({
  allowedMimeTypes: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'application/pdf',
  ],
  maxBytes: 20 * 1024 * 1024, // 20 Mo
  fieldName: 'fileDataUrl',
});

export const ANY_FILE_DATA_URL_PIPE = new DataUrlValidationPipe({
  maxBytes: 20 * 1024 * 1024, // 20 Mo
  fieldName: 'fileDataUrl',
});
