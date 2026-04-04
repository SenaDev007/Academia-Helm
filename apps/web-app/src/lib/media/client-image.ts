/**
 * Compression / redimensionnement d’images côté navigateur (avant envoi API / DB).
 * Évite les data URLs énormes (logos, photos) et accélère l’affichage.
 */

export type CompressImageFileOptions = {
  /** Plus grand côté en px (défaut 1024). */
  maxEdge?: number;
  /** Qualité JPEG/WebP 0–1 (défaut 0.82). */
  quality?: number;
  /** Sortie : JPEG très compatible ; WebP si le navigateur le supporte en toDataURL. */
  mimeType?: 'image/jpeg' | 'image/webp';
};

const DEFAULT_MAX = 1024;
const DEFAULT_Q = 0.82;

/**
 * Lit un fichier image, redimensionne (fit inside), ré-encode en JPEG ou WebP.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageFileOptions = {},
): Promise<string> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX;
  const quality = options.quality ?? DEFAULT_Q;
  const mimeType = options.mimeType ?? 'image/jpeg';

  if (!file.type.startsWith('image/')) {
    throw new TypeError('Le fichier doit être une image.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    let w = width;
    let h = height;
    if (width > maxEdge || height > maxEdge) {
      if (width >= height) {
        w = maxEdge;
        h = Math.max(1, Math.round((height * maxEdge) / width));
      } else {
        h = maxEdge;
        w = Math.max(1, Math.round((width * maxEdge) / height));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D indisponible');
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (mimeType === 'image/webp') {
      try {
        const u = canvas.toDataURL('image/webp', quality);
        if (u.startsWith('data:image/webp')) return u;
      } catch {
        /* fallback jpeg */
      }
    }
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
