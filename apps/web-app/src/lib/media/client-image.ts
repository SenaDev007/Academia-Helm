/**
 * Compression / redimensionnement d'images côté navigateur (avant envoi API / DB).
 * Evite les data URLs enormes (logos, photos) et accelere l'affichage.
 *
 * Strategie d'optimisation :
 *   1. Redimensionner (maxEdge) pour eviter les images trop grandes
 *   2. Convertir en WebP (compression moderne, 25-35% plus petit que JPEG)
 *   3. Fallback JPEG si WebP non supporte par le navigateur
 *   4. Fallback PNG si l'image a de la transparence (alpha channel)
 */

export type CompressImageFileOptions = {
  /** Plus grand cote en px (defaut 600 pour photos d'eleves, 1024 pour logos). */
  maxEdge?: number;
  /** Qualite WebP/JPEG 0-1 (defaut 0.82). */
  quality?: number;
  /** Format de sortie force (defaut: auto - WebP si supporte). */
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Preserver la transparence (defaut: true). Si true, PNG pour images avec alpha. */
  preserveTransparency?: boolean;
};

const DEFAULT_MAX = 600;
const DEFAULT_Q = 0.82;

/**
 * Verifie si le navigateur supporte l'encodage WebP.
 * Mise en cache du resultat (test une seule fois).
 */
let _webpSupport: boolean | null = null;
async function checkWebPSupport(): Promise<boolean> {
  if (_webpSupport !== null) return _webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    _webpSupport = canvas.toDataURL('image/webp', 0.5).startsWith('data:image/webp');
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

/**
 * Lit un fichier image, redimensionne (fit inside), re-encode en WebP.
 *
 * Strategie :
 *   - WebP par defaut (meilleure compression, supporte la transparence)
 *   - Si WebP non supporte -> JPEG (sans transparence) ou PNG (avec transparence)
 *   - Si l'image source a de la transparence -> WebP (supporte alpha) ou PNG (fallback)
 *
 * @param file Fichier image a compresser
 * @param options Options de compression (maxEdge, quality, mimeType, preserveTransparency)
 *   OU ancien format positionnel : (file, maxEdge: number, quality: number)
 * @returns Data URL optimisee (data:image/webp;base64,... ou fallback)
 */
export async function compressImageFileToDataUrl(
  file: File | Blob,
  options?: CompressImageFileOptions | number,
): Promise<string> {
  // Compatibilite : l'ancien code appelait compressImageFileToDataUrl(file, 600, 0.8)
  // avec des arguments positionnels au lieu d'un objet options. On gere les 2 cas.
  let opts: CompressImageFileOptions = {};
  if (typeof options === 'number') {
    // Ancien format : (file, maxEdge, quality)
    opts = {
      maxEdge: options,
      quality: typeof arguments[2] === 'number' ? arguments[2] : DEFAULT_Q,
    };
  } else if (options && typeof options === 'object') {
    opts = options;
  }

  const maxEdge = opts.maxEdge ?? DEFAULT_MAX;
  const quality = opts.quality ?? DEFAULT_Q;
  const preserveTransparency = opts.preserveTransparency ?? true;

  // Verifier le support WebP
  const webpSupported = await checkWebPSupport();

  // Determiner le mimeType de sortie
  let mimeType = opts.mimeType;
  if (!mimeType) {
    // WebP si supporte (meilleure compression + transparence)
    if (webpSupported) {
      mimeType = 'image/webp';
    } else if (preserveTransparency && (file.type === 'image/png' || file.type === 'image/webp')) {
      mimeType = 'image/png';
    } else {
      mimeType = 'image/jpeg';
    }
  }

  if (!file.type.startsWith('image/')) {
    throw new TypeError('Le fichier doit etre une image.');
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

    // Tentative WebP en premier (meilleure compression)
    if (mimeType === 'image/webp') {
      try {
        const u = canvas.toDataURL('image/webp', quality);
        if (u.startsWith('data:image/webp')) return u;
      } catch {
        /* fallback */
      }
      // WebP non supporte pour cette image -> fallback
      if (preserveTransparency && (file.type === 'image/png' || file.type === 'image/webp')) {
        mimeType = 'image/png';
      } else {
        mimeType = 'image/jpeg';
      }
    }

    if (mimeType === 'image/png') {
      return canvas.toDataURL('image/png');
    }

    // Pour JPEG, remplir le fond en blanc (pas de transparence en JPEG)
    if (mimeType === 'image/jpeg') {
      const jpegCanvas = document.createElement('canvas');
      jpegCanvas.width = w;
      jpegCanvas.height = h;
      const jpegCtx = jpegCanvas.getContext('2d');
      if (jpegCtx) {
        jpegCtx.fillStyle = '#ffffff';
        jpegCtx.fillRect(0, 0, w, h);
        jpegCtx.drawImage(canvas, 0, 0);
        return jpegCtx.canvas.toDataURL('image/jpeg', quality);
      }
    }

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
