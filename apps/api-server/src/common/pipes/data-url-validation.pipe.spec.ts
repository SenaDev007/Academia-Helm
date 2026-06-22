/**
 * ============================================================================
 * UNIT TESTS — DataUrlValidationPipe
 * ============================================================================
 *
 * Tests unitaires pour le pipe de validation des data URLs.
 * Couvre tous les cas: format valide, invalide, MIME types, tailles, etc.
 *
 * Run: npx jest --config jest.config.ts data-url-validation.pipe.spec.ts
 * ============================================================================
 */

import { BadRequestException } from '@nestjs/common';
import {
  DataUrlValidationPipe,
  DataUrlHelper,
  IMAGE_ONLY_DATA_URL_PIPE,
  IMAGE_OR_PDF_DATA_URL_PIPE,
  ANY_FILE_DATA_URL_PIPE,
} from './data-url-validation.pipe';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Génère un data URL JPEG valide de taille donnée (en bytes) */
function makeJpegDataUrl(sizeBytes: number): string {
  const payload = 'A'.repeat(sizeBytes);
  const base64 = Buffer.from(payload).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

function makePdfDataUrl(sizeBytes: number): string {
  const payload = '%PDF-1.4' + '0'.repeat(sizeBytes);
  const base64 = Buffer.from(payload).toString('base64');
  return `data:application/pdf;base64,${base64}`;
}

// ─── Tests DataUrlHelper ──────────────────────────────────────────────────

describe('DataUrlHelper', () => {
  describe('isDataUrl', () => {
    it('accepte un data URL image valide', () => {
      expect(DataUrlHelper.isDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    });

    it('accepte un data URL PDF valide', () => {
      expect(DataUrlHelper.isDataUrl('data:application/pdf;base64,JVBERi0=')).toBe(true);
    });

    it('rejette une string vide', () => {
      expect(DataUrlHelper.isDataUrl('')).toBe(false);
    });

    it('rejette une string non-data', () => {
      expect(DataUrlHelper.isDataUrl('https://example.com/image.jpg')).toBe(false);
      expect(DataUrlHelper.isDataUrl('not a url')).toBe(false);
    });

    it('rejette null/undefined', () => {
      expect(DataUrlHelper.isDataUrl(null as any)).toBe(false);
      expect(DataUrlHelper.isDataUrl(undefined as any)).toBe(false);
    });
  });

  describe('decode', () => {
    it('décode un data URL et retourne le buffer', () => {
      const dataUrl = 'data:image/jpeg;base64,SGVsbG8gV29ybGQ=';
      const result = DataUrlHelper.decode(dataUrl);
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('image/jpeg');
      expect(result!.buffer.toString()).toBe('Hello World');
      expect(result!.size).toBe(11);
    });

    it('retourne null pour un format invalide', () => {
      expect(DataUrlHelper.decode('not-a-data-url')).toBeNull();
      expect(DataUrlHelper.decode('')).toBeNull();
    });
  });
});

// ─── Tests DataUrlValidationPipe ──────────────────────────────────────────

describe('DataUrlValidationPipe', () => {
  describe('Validation de base', () => {
    const pipe = new DataUrlValidationPipe();

    it('accepte un data URL valide et le retourne', () => {
      const dataUrl = makeJpegDataUrl(100);
      const result = pipe.transform(dataUrl);
      expect(result).toBe(dataUrl);
    });

    it('rejette null', () => {
      expect(() => pipe.transform(null)).toThrow(BadRequestException);
    });

    it('rejette undefined', () => {
      expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
    });

    it('rejette une string vide', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('rejette un non-string', () => {
      expect(() => pipe.transform(123 as any)).toThrow(BadRequestException);
      expect(() => pipe.transform({} as any)).toThrow(BadRequestException);
    });

    it('rejette un format non-data-URL', () => {
      expect(() => pipe.transform('https://example.com/image.jpg')).toThrow(BadRequestException);
      expect(() => pipe.transform('data:notbase64')).toThrow(BadRequestException);
    });
  });

  describe('Validation MIME types', () => {
    const pipe = new DataUrlValidationPipe({
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    });

    it('accepte un MIME type autorisé', () => {
      const jpeg = 'data:image/jpeg;base64,SGVsbG8=';
      const png = 'data:image/png;base64,SGVsbG8=';
      expect(pipe.transform(jpeg)).toBe(jpeg);
      expect(pipe.transform(png)).toBe(png);
    });

    it('rejette un MIME type non autorisé', () => {
      const pdf = 'data:application/pdf;base64,SGVsbG8=';
      expect(() => pipe.transform(pdf)).toThrow(BadRequestException);
      expect(() => pipe.transform(pdf)).toThrow(/non supporté.*application\/pdf/);
    });

    it('rejette un MIME type avec majuscules (normalisation)', () => {
      // Le pipe normalise en lowercase, donc IMAGE/JPEG devrait être accepté
      const jpeg = 'data:IMAGE/JPEG;base64,SGVsbG8=';
      expect(pipe.transform(jpeg)).toBe(jpeg);
    });
  });

  describe('Validation taille', () => {
    it('accepte un fichier en dessous de la limite', () => {
      const pipe = new DataUrlValidationPipe({ maxBytes: 1024 });
      const dataUrl = makeJpegDataUrl(500);
      expect(pipe.transform(dataUrl)).toBe(dataUrl);
    });

    it('rejette un fichier au-dessus de la limite', () => {
      const pipe = new DataUrlValidationPipe({ maxBytes: 1024 });
      const dataUrl = makeJpegDataUrl(2000);
      expect(() => pipe.transform(dataUrl)).toThrow(BadRequestException);
      expect(() => pipe.transform(dataUrl)).toThrow(/trop volumineux/);
    });

    it('accepte exactement à la limite', () => {
      const pipe = new DataUrlValidationPipe({ maxBytes: 100 });
      const dataUrl = makeJpegDataUrl(100);
      expect(pipe.transform(dataUrl)).toBe(dataUrl);
    });
  });

  describe('Messages d\'erreur personnalisés', () => {
    it('utilise fieldName dans les messages d\'erreur', () => {
      const pipe = new DataUrlValidationPipe({ fieldName: 'photoProfile' });
      expect(() => pipe.transform(null)).toThrow(/photoProfile/);
      expect(() => pipe.transform('invalid')).toThrow(/photoProfile/);
    });
  });
});

// ─── Tests des pipes pré-configurés ───────────────────────────────────────

describe('IMAGE_ONLY_DATA_URL_PIPE', () => {
  it('accepte les images JPEG, PNG, WebP, GIF, AVIF', () => {
    const mimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    for (const mime of mimes) {
      const dataUrl = `data:${mime};base64,SGVsbG8=`;
      expect(IMAGE_ONLY_DATA_URL_PIPE.transform(dataUrl)).toBe(dataUrl);
    }
  });

  it('rejette les PDF', () => {
    const pdf = 'data:application/pdf;base64,SGVsbG8=';
    expect(() => IMAGE_ONLY_DATA_URL_PIPE.transform(pdf)).toThrow(BadRequestException);
  });

  it('rejette les fichiers > 5 Mo', () => {
    const largeImage = makeJpegDataUrl(6 * 1024 * 1024); // 6 Mo
    expect(() => IMAGE_ONLY_DATA_URL_PIPE.transform(largeImage)).toThrow(/trop volumineux/);
  });

  it('accepte les images < 5 Mo', () => {
    const smallImage = makeJpegDataUrl(3 * 1024 * 1024); // 3 Mo
    expect(IMAGE_ONLY_DATA_URL_PIPE.transform(smallImage)).toBe(smallImage);
  });
});

describe('IMAGE_OR_PDF_DATA_URL_PIPE', () => {
  it('accepte les images', () => {
    const jpeg = 'data:image/jpeg;base64,SGVsbG8=';
    expect(IMAGE_OR_PDF_DATA_URL_PIPE.transform(jpeg)).toBe(jpeg);
  });

  it('accepte les PDF', () => {
    const pdf = makePdfDataUrl(100);
    expect(IMAGE_OR_PDF_DATA_URL_PIPE.transform(pdf)).toBe(pdf);
  });

  it('rejette les autres types (video, audio, etc.)', () => {
    const mp4 = 'data:video/mp4;base64,SGVsbG8=';
    expect(() => IMAGE_OR_PDF_DATA_URL_PIPE.transform(mp4)).toThrow(BadRequestException);
  });

  it('rejette les fichiers > 20 Mo', () => {
    const largePdf = makePdfDataUrl(21 * 1024 * 1024);
    expect(() => IMAGE_OR_PDF_DATA_URL_PIPE.transform(largePdf)).toThrow(/trop volumineux/);
  });
});

describe('ANY_FILE_DATA_URL_PIPE', () => {
  it('accepte n\'importe quel type MIME', () => {
    const types = ['image/jpeg', 'application/pdf', 'video/mp4', 'audio/mpeg', 'text/plain', 'application/zip'];
    for (const type of types) {
      const dataUrl = `data:${type};base64,SGVsbG8=`;
      expect(ANY_FILE_DATA_URL_PIPE.transform(dataUrl)).toBe(dataUrl);
    }
  });

  it('rejette les fichiers > 20 Mo', () => {
    const largeFile = makeJpegDataUrl(21 * 1024 * 1024);
    expect(() => ANY_FILE_DATA_URL_PIPE.transform(largeFile)).toThrow(/trop volumineux/);
  });
});

// ─── Tests d'intégration: patterns des 5 endpoints standardisés ──────────

describe('Endpoints upload standardisés — patterns de validation', () => {
  // Ces tests documentent le comportement attendu de chaque endpoint.
  // Pour des tests E2E complets (avec DB), voir test/upload-endpoints.e2e-spec.ts

  it('POST /hr/staff/:id/upload-photo — accepte image ≤ 5 Mo via IMAGE_ONLY_DATA_URL_PIPE', () => {
    const validPhoto = makeJpegDataUrl(2 * 1024 * 1024); // 2 Mo
    expect(() => IMAGE_ONLY_DATA_URL_PIPE.transform(validPhoto)).not.toThrow();
  });

  it('POST /hr/staff/:id/upload-document — accepte image ou PDF ≤ 20 Mo via IMAGE_OR_PDF_DATA_URL_PIPE', () => {
    const validImage = makeJpegDataUrl(5 * 1024 * 1024);
    const validPdf = makePdfDataUrl(10 * 1024 * 1024);
    expect(() => IMAGE_OR_PDF_DATA_URL_PIPE.transform(validImage)).not.toThrow();
    expect(() => IMAGE_OR_PDF_DATA_URL_PIPE.transform(validPdf)).not.toThrow();
  });

  it('POST /reviews/upload-photo — accepte image ≤ 2 Mo (custom config)', () => {
    const pipe = new DataUrlValidationPipe({
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      maxBytes: 2 * 1024 * 1024,
    });
    const validPhoto = makeJpegDataUrl(1 * 1024 * 1024); // 1 Mo
    expect(() => pipe.transform(validPhoto)).not.toThrow();
  });

  it('POST /pedagogy/programs/upload-program — accepte image ou PDF ≤ 20 Mo', () => {
    const validProgram = makePdfDataUrl(5 * 1024 * 1024);
    expect(() => IMAGE_OR_PDF_DATA_URL_PIPE.transform(validProgram)).not.toThrow();
  });

  it('POST /hr/recruitment/upload-apply — accepte CV + lettres en data URLs (validation côté service)', () => {
    // Le endpoint upload-apply ne valide pas via pipe (body complexe multi-fichiers).
    // La validation se fait dans le contrôleur via convertToFile().
    // Ce test documente que les data URLs individuelles sont valides.
    const cv = makePdfDataUrl(2 * 1024 * 1024);
    const coverLetter = makePdfDataUrl(1 * 1024 * 1024);
    expect(DataUrlHelper.isDataUrl(cv)).toBe(true);
    expect(DataUrlHelper.isDataUrl(coverLetter)).toBe(true);
  });
});
