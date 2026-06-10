/**
 * Configuration de la marque Academia Helm
 * Modifier ici pour mettre à jour le nom, sous-titre, description et slogan dans l'app.
 */

export const BRAND = {
  name: 'Academia Helm',
  subtitle: 'Plateforme de pilotage éducatif',
  description: 'La plateforme de pilotage éducatif nouvelle génération',
  slogan: 'Prenez le gouvernail de votre institution',
  /** Chemin du logo (nom de fichier inchangé pour éviter de casser les assets) */
  logoPath: '/images/logo-Academia Hub.png',
} as const;

export const BRAND_NAME = BRAND.name;
export const BRAND_SUBTITLE = BRAND.subtitle;
export const BRAND_DESCRIPTION = BRAND.description;
export const BRAND_SLOGAN = BRAND.slogan;
