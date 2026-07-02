/**
 * Compression / redimensionnement d’images côté navigateur (avant envoi API / DB).
 * Évite les data URLs énormes (logos, photos) et accélère l’affichage.
 */

export type CompressImageFileOptions = {
  /** Plus grand côté en px (défaut 1024). */
  maxEdge?: number;
  /** Qualité JPEG/WebP 0–1 (défaut 0.82). */
  quality?: number;
  /** Sortie : PNG préserve la transparence ; JPEG très compatible ; WebP si supporté. */
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  /**
   * Préserver la transparence (défaut : true).
   * Si true et que le fichier source est PNG/WebP avec transparence, on garde PNG.
   * Si false, on force le mimeType demandé (ex: JPEG = fond noir pour les PNG transparents).
   */
  preserveTransparency?: boolean;
};

const DEFAULT_MAX = 1024;
const DEFAULT_Q = 0.82;

/**
 * Lit un fichier image, redimensionne (fit inside), ré-encode.
 * Par défaut, préserve la transparence (PNG) pour les logos et images avec alpha.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageFileOptions = {},
): Promise<string> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX;
  const quality = options.quality ?? DEFAULT_Q;
  const preserveTransparency = options.preserveTransparency ?? true;

  // Déterminer le mimeType de sortie
  let mimeType = options.mimeType ?? 'image/jpeg';

  // ⚠️ Si le fichier source a de la transparence (PNG, WebP) et qu'on veut la préserver,
  // on force PNG (le seul format universellement supporté avec alpha channel).
  // JPEG ne supporte PAS la transparence → les pixels transparents deviennent NOIRS.
  if (preserveTransparency && (file.type === 'image/png' || file.type === 'image/webp')) {
    mimeType = 'image/png';
  }

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

    // ⚠️ Ne PAS remplir le canvas avec une couleur de fond si on préserve la transparence.
    // Le canvas est transparent par défaut. drawImage préserve l'alpha channel.
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (mimeType === 'image/webp') {
      try {
        const u = canvas.toDataURL('image/webp', quality);
        if (u.startsWith('data:image/webp')) return u;
      } catch {
        /* fallback png ou jpeg */
      }
    }

    if (mimeType === 'image/png') {
      return canvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
