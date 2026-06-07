/**
 * Subdomain Utilities
 * 
 * Utilitaires pour la génération et validation de sous-domaines
 */

/**
 * Génère un sous-domaine à partir du nom de l'établissement
 * 
 * Règles :
 * - Minuscules uniquement
 * - Remplace les espaces et caractères spéciaux par des tirets
 * - Supprime les accents
 * - Limite à 50 caractères
 * - Vérifie l'unicité
 */
export function generateSubdomain(schoolName: string): string {
  // Normaliser le nom
  let subdomain = schoolName
    .toLowerCase()
    .trim()
    // Supprimer les accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remplacer espaces et caractères spéciaux par tirets
    .replace(/[^a-z0-9-]/g, '-')
    // Supprimer les tirets multiples
    .replace(/-+/g, '-')
    // Supprimer les tirets en début et fin
    .replace(/^-+|-+$/g, '')
    // Limiter à 50 caractères
    .substring(0, 50);

  // Si vide après normalisation, utiliser un fallback
  if (!subdomain) {
    subdomain = 'ecole-' + Date.now().toString(36);
  }

  return subdomain;
}

/**
 * Génère un sous-domaine unique en ajoutant un suffixe si nécessaire
 */
export async function generateUniqueSubdomain(
  baseSubdomain: string,
  checkAvailability: (subdomain: string) => Promise<boolean>
): Promise<string> {
  let candidate = baseSubdomain;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const isAvailable = await checkAvailability(candidate);
    
    if (isAvailable) {
      return candidate;
    }

    // Générer un nouveau candidat avec suffixe
    attempts++;
    const suffix = attempts === 1 ? '' : `-${attempts}`;
    candidate = baseSubdomain.substring(0, 50 - suffix.length) + suffix;
  }

  // Si tous les essais échouent, utiliser un timestamp
  return `${baseSubdomain.substring(0, 30)}-${Date.now().toString(36)}`;
}

/**
 * Valide un sous-domaine
 */
export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain || subdomain.length < 3) {
    return { valid: false, error: 'Le sous-domaine doit contenir au moins 3 caractères' };
  }

  if (subdomain.length > 50) {
    return { valid: false, error: 'Le sous-domaine ne peut pas dépasser 50 caractères' };
  }

  // Vérifier le format (lettres, chiffres, tirets uniquement)
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return { valid: false, error: 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets' };
  }

  // Ne peut pas commencer ou finir par un tiret
  if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
    return { valid: false, error: 'Le sous-domaine ne peut pas commencer ou finir par un tiret' };
  }

  // Mots réservés
  const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev'];
  if (reserved.includes(subdomain)) {
    return { valid: false, error: 'Ce sous-domaine est réservé' };
  }

  return { valid: true };
}

