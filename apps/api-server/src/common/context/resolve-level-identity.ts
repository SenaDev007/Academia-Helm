/**
 * ============================================================================
 * RESOLVE LEVEL IDENTITY — identité effective d'un document selon le niveau
 * ============================================================================
 * ⭐ 2026-11-13 — Écoles combinées (maternelle+primaire+secondaire) dont le
 * secondaire porte un nom, des contacts et un logo DIFFÉRENTS :
 *
 *   tenant_level_identity_profiles (une ligne max par niveau, clée sur
 *   education_levels) override le profil d'identité global
 * (tenant_identity_profiles) pour les documents du niveau concerné.
 *
 * USAGE — chaque module PDF qui connaît déjà le niveau du document appelle :
 *
 *   const overlay = await resolveLevelIdentityOverlay(prisma, tenantId, {
 *     isSecondary,                     // bool (déjà calculé par le module)
 *     schoolLevelId,                   // ou UUID school_levels de l'élève
 *     levelCode,                       // ou code MAT/PRI/SEC…
 *   });
 *   branding = applyLevelIdentityOverlay(branding, overlay);
 *
 * RÈGLES :
 *   - pas de ligne secondaire → overlay null → identité globale inchangée ;
 *   - champ null/'' dans la ligne → retombe sur le champ global correspondant
 *     (override partiel autorisé : ex. nom + logo différents, même téléphone) ;
 *   - le site public institutionnel n'appelle JAMAIS ce helper (défaut
 *     maternelle/primaire, exigence produit).
 *
 * Cache mémoire par tenant (TTL 60 s) — même stratégie que
 * common/context/resolve-school-level.ts ; invalidé par
 * invalidateLevelIdentityCache() après chaque sauvegarde (LevelIdentityService).
 * ============================================================================
 */

import { PrismaService } from '../../database/prisma.service';

/** Codes school_levels/education_levels assimables au niveau SECONDAIRE. */
const SECONDARY_CODES = new Set(['SECONDAIRE', 'SECONDARY', 'SEC']);

/** Champs d'identité overridables (miroir de TenantLevelIdentityProfile). */
const OVERLAY_FIELDS = [
  'schoolName',
  'schoolAcronym',
  'slogan',
  'phonePrimary',
  'phoneSecondary',
  'whatsapp',
  'email',
  'website',
  'address',
  'city',
  'department',
  'postalCode',
  'country',
  'logoUrl',
] as const;

export type LevelIdentityField = (typeof OVERLAY_FIELDS)[number];

export interface LevelIdentityOverlay {
  schoolName: string;
  schoolAcronym?: string | null;
  slogan?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  postalCode?: string | null;
  country?: string | null;
  logoUrl?: string | null;
}

const CACHE_TTL_MS = 60 * 1000;
const overlayCache = new Map<string, { data: LevelIdentityOverlay | null; expiresAt: number }>();

/** Invalide le cache d'identité par niveau d'un tenant (après mutation). */
export function invalidateLevelIdentityCache(tenantId: string): void {
  const prefix = `${tenantId}:`;
  for (const key of overlayCache.keys()) {
    if (key.startsWith(prefix)) overlayCache.delete(key);
  }
}

function isSecondaryCode(code?: string | null): boolean {
  return SECONDARY_CODES.has((code || '').toUpperCase().trim());
}

/**
 * Résout l'overlay d'identité du niveau SECONDAIRE pour un tenant.
 * @returns null si le document n'est pas secondaire OU si aucune identité
 *          secondaire n'est configurée (identité globale à utiliser telle quelle).
 */
export async function resolveLevelIdentityOverlay(
  prisma: PrismaService,
  tenantId: string,
  opts: { isSecondary?: boolean; schoolLevelId?: string | null; levelCode?: string | null },
): Promise<LevelIdentityOverlay | null> {
  // 1. Le document concerne-t-il le secondaire ?
  let secondary = false;
  if (typeof opts.isSecondary === 'boolean') {
    secondary = opts.isSecondary;
  } else if (opts.levelCode) {
    secondary = isSecondaryCode(opts.levelCode);
  } else if (opts.schoolLevelId) {
    try {
      const sl = await prisma.schoolLevel.findUnique({
        where: { id: opts.schoolLevelId },
        select: { code: true },
      });
      secondary = isSecondaryCode(sl?.code);
    } catch {
      secondary = false;
    }
  }
  if (!secondary) return null;

  // 2. Cache (TTL court : la ressource est quasi immuable, invalidée à la save)
  const cacheKey = `${tenantId}:SECONDAIRE`;
  const cached = overlayCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // 3. Ligne d'identité du secondaire (niveau FR ou miroir EN — même ligne)
  const row = await prisma.tenantLevelIdentityProfile.findFirst({
    where: {
      tenantId,
      educationLevel: { name: { in: ['SECONDAIRE', 'SECONDARY'] } },
    },
  });

  const overlay: LevelIdentityOverlay | null = row
    ? ({
        schoolName: row.schoolName,
        schoolAcronym: row.schoolAcronym,
        slogan: row.slogan,
        phonePrimary: row.phonePrimary,
        phoneSecondary: row.phoneSecondary,
        whatsapp: row.whatsapp,
        email: row.email,
        website: row.website,
        address: row.address,
        city: row.city,
        department: row.department,
        postalCode: row.postalCode,
        country: row.country,
        logoUrl: row.logoUrl,
      } as LevelIdentityOverlay)
    : null;

  overlayCache.set(cacheKey, { data: overlay, expiresAt: Date.now() + CACHE_TTL_MS });
  return overlay;
}

/**
 * Applique l'overlay sur un branding déjà résolu (getTenantBranding local).
 * Seuls les champs NON VIDES de l'override remplacent les valeurs globales ;
 * un branding null/undefined reste inchangé (retour tel quel).
 */
export function applyLevelIdentityOverlay<T extends Record<string, any>>(
  branding: T | null | undefined,
  overlay: LevelIdentityOverlay | null,
): T | null | undefined {
  if (!branding) return branding;
  if (!overlay) return branding;
  const merged: Record<string, any> = { ...branding };
  for (const field of OVERLAY_FIELDS) {
    const value = (overlay as Record<string, any>)[field];
    if (value !== null && value !== undefined && value !== '') {
      merged[field] = value;
    }
  }
  return merged as T;
}
