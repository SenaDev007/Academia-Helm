/**
 * ============================================================================
 * SCHOOL BRANDING UTILITIES — EXTRACTION ET RÉSOLUTION
 * ============================================================================
 *
 * Fonctions partagées pour extraire le branding d'une école depuis les données
 * brutes du tenant NestJS. Utilisées par les server components (school-portal,
 * login, forgot-password) et la route BFF.
 *
 * Résolution du branding (priorité décroissante) :
 *   1. TenantIdentityProfile (active) → le profil d'identité actif du tenant
 *   2. SchoolSettings → paramètres spécifiques de l'école
 *   3. School (legacy) → modèle School historique
 *   4. Tenant → données de base du tenant (nom, slug)
 */

/** Branding extrait et plat — utilisé par les composants UI */
export interface SchoolBrandingData {
  tenantId?: string | null;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
  schoolAcronym?: string | null;
  schoolType?: string | null;
  website?: string | null;
  email?: string | null;
}

/**
 * Extraction du branding depuis la réponse brute du tenant NestJS.
 *
 * @param data - Objet tenant retourné par /api/tenants/by-subdomain/:slug
 * @param slug - Slug du tenant (utilisé comme fallback pour le nom)
 * @returns Objet de branding plat
 */
export function extractBrandingFromTenant(
  data: Record<string, any>,
  slug: string,
): SchoolBrandingData {
  const identity = data.identityProfiles?.[0] ?? null;
  const settings = data.schoolSettings ?? null;
  const school = data.schools ?? null;

  return {
    tenantId: data.id || null,
    name: identity?.schoolName || settings?.schoolName || school?.name || data.name || slug,
    slug: data.slug || slug,
    logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
    city: identity?.city || settings?.city || school?.city || null,
    phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
    address: identity?.address || settings?.address || school?.address || null,
    primaryColor: settings?.primaryColor || school?.primaryColor || null,
    secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
    slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
    motto: school?.motto || null,
    schoolAcronym: identity?.schoolAcronym || school?.abbreviation || null,
    schoolType: identity?.schoolType || null,
    website: identity?.website || settings?.website || school?.website || null,
    email: identity?.email || settings?.email || school?.primaryEmail || null,
  };
}
