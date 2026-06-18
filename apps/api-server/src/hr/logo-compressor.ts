/**
 * ============================================================================
 * LOGO COMPRESSOR — Compresse les logos base64 pour les emails
 * ============================================================================
 *
 * Les logos d'école sont stockés en base64 dans TenantIdentityProfile.logoUrl.
 * Ces logos peuvent faire 100+ KB, ce qui est trop volumineux pour les emails
 * (Gmail/Outlook bloquent les images base64 > ~30 KB).
 *
 * Ce utilitaire :
 *   1. Prend un data URL base64 (data:image/jpeg;base64,...)
 *   2. Le décode en Buffer
 *   3. Utilise sharp pour redimensionner (max 200x60) et compresser (qualité 70)
 *   4. Retourne un nouveau data URL base64 optimisé (< 30 KB)
 *
 * Le résultat est mis en cache en mémoire (par tenantId) pour éviter de
 * recompresser le même logo à chaque envoi d'email.
 * ============================================================================
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('LogoCompressor');

// Cache en mémoire : tenantId → logo compressé
const logoCache = new Map<string, { originalHash: string; compressed: string }>();

/**
 * Hash simple pour détecter si le logo a changé (évite la recompression).
 */
function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(s.length, 1000); i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return String(hash) + '_' + s.length;
}

/**
 * Compresse un logo base64 pour utilisation dans les emails.
 *
 * @param base64DataUrl - Le data URL (data:image/jpeg;base64,...) ou URL http
 * @param tenantId - ID du tenant (pour le cache)
 * @returns Le data URL compressé, ou null si la compression échoue
 */
export async function compressLogoForEmail(
  base64DataUrl: string,
  tenantId: string,
): Promise<string | null> {
  // Si c'est une URL http(s), pas besoin de compresser
  if (!base64DataUrl || base64DataUrl.startsWith('http')) {
    return base64DataUrl || null;
  }

  // Si ce n'est pas du base64, retourner tel quel
  if (!base64DataUrl.startsWith('data:')) {
    return base64DataUrl || null;
  }

  // Si le base64 est déjà petit (< 25 KB), pas besoin de compresser
  if (base64DataUrl.length < 25000) {
    return base64DataUrl;
  }

  // Vérifier le cache
  const hash = simpleHash(base64DataUrl);
  const cached = logoCache.get(tenantId);
  if (cached && cached.originalHash === hash) {
    logger.debug(`Logo compressé récupéré du cache pour tenant ${tenantId}`);
    return cached.compressed;
  }

  try {
    // Import dynamique de sharp (évite les erreurs si sharp n'est pas installé)
    let sharp: any;
    try {
      sharp = (await import('sharp')).default;
    } catch (importErr: any) {
      logger.warn(`sharp non disponible sur cette instance — le logo ne sera pas compressé: ${importErr.message}`);
      // Sans sharp, on ne peut pas compresser. Si le logo est trop volumineux,
      // on retourne null (le template affichera les initiales à la place).
      if (base64DataUrl.length > 50000) {
        return null;
      }
      return base64DataUrl;
    }

    // Extraire le type MIME et les données base64
    const matches = base64DataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
    if (!matches) {
      logger.warn(`Format base64 invalide pour le logo du tenant ${tenantId}`);
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Déterminer le format de sortie : PNG pour les logos avec transparence, JPEG sinon
    const outputFormat = mimeType.includes('png') ? 'png' : 'jpeg';

    // Compresser avec sharp :
    // - Redimensionner à max 200x60 (ratio préservé)
    // - Qualité 70 (bon compromis taille/qualité pour un logo)
    let compressedBuffer: Buffer;

    if (outputFormat === 'png') {
      compressedBuffer = await sharp(buffer)
        .resize(200, 60, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer();
    } else {
      compressedBuffer = await sharp(buffer)
        .resize(200, 60, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    }

    // Convertir en base64
    const compressedBase64 = compressedBuffer.toString('base64');
    const outputMime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const compressedDataUrl = `data:${outputMime};base64,${compressedBase64}`;

    // Vérifier la taille finale
    if (compressedDataUrl.length > 30000) {
      // Si encore trop volumineux, réduire davantage
      logger.warn(
        `Logo encore volumineux après première compression (${compressedDataUrl.length} chars) — seconde passe pour tenant ${tenantId}`,
      );
      if (outputFormat === 'png') {
        compressedBuffer = await sharp(buffer)
          .resize(150, 45, { fit: 'inside', withoutEnlargement: true })
          .png({ quality: 50, compressionLevel: 9 })
          .toBuffer();
      } else {
        compressedBuffer = await sharp(buffer)
          .resize(150, 45, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 50 })
          .toBuffer();
      }
      const finalBase64 = compressedBuffer.toString('base64');
      const finalMime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
      const finalDataUrl = `data:${finalMime};base64,${finalBase64}`;

      logger.log(
        `Logo compressé (2 passes) pour tenant ${tenantId}: ${base64DataUrl.length} → ${finalDataUrl.length} chars`,
      );

      // Mettre en cache
      logoCache.set(tenantId, { originalHash: hash, compressed: finalDataUrl });
      return finalDataUrl;
    }

    logger.log(
      `Logo compressé pour tenant ${tenantId}: ${base64DataUrl.length} → ${compressedDataUrl.length} chars`,
    );

    // Mettre en cache
    logoCache.set(tenantId, { originalHash: hash, compressed: compressedDataUrl });
    return compressedDataUrl;
  } catch (err: any) {
    logger.warn(
      `Compression de logo échouée pour tenant ${tenantId}: ${err.message} — utilisation du logo original`,
    );
    // Si la compression échoue (sharp non disponible, etc.), retourner l'original
    // s'il n'est pas trop volumineux, sinon null
    if (base64DataUrl.length < 50000) {
      return base64DataUrl;
    }
    return null;
  }
}

/**
 * Vide le cache des logos compressés (utile après mise à jour du logo).
 */
export function clearLogoCache(tenantId?: string): void {
  if (tenantId) {
    logoCache.delete(tenantId);
  } else {
    logoCache.clear();
  }
}
