/**
 * Configuration de la marque Academia Helm
 * Modifier ici pour mettre à jour le nom, sous-titre, description et slogan dans l'app.
 */

export const BRAND = {
  name: 'Academia Helm',
  subtitle: 'Plateforme de pilotage éducatif',
  description: 'La plateforme de pilotage éducatif nouvelle génération',
  slogan: 'Prenez le gouvernail de votre institution',
  /**
   * Chemin du logo — ⭐ PERF (chantier GTMetrix) : WebP 27 Ko (transparence
   * alpha conservée) au lieu du PNG 320 Ko (÷12). Les emails gardent leur
   * PNG dédié (les clients mail ne supportent pas webp de façon fiable —
   * voir lib/admin/email-templates.ts).
   */
  logoPath: '/images/logo-Academia Hub.webp',
} as const;

export const BRAND_NAME = BRAND.name;
export const BRAND_SUBTITLE = BRAND.subtitle;
export const BRAND_DESCRIPTION = BRAND.description;
export const BRAND_SLOGAN = BRAND.slogan;
