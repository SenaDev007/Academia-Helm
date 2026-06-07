/**
 * Platform Detection Utility for Next.js
 * 
 * Détecte la plateforme d'exécution (Web, Mobile)
 * WEB ONLY - Pas de support Electron dans cette version
 */

export type Platform = 'web' | 'mobile';

/**
 * Détecte la plateforme actuelle
 */
export function getPlatform(): Platform {
  // Vérifier le flag d'environnement explicite
  const envPlatform = process.env.NEXT_PUBLIC_PLATFORM;
  if (envPlatform === 'web' || envPlatform === 'mobile') {
    return envPlatform;
  }

  // En Next.js, on est toujours sur Web (pas d'Electron)
  if (typeof window !== 'undefined') {
    // Vérifier si on est sur mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    if (isMobile) {
      return 'mobile';
    }
  }

  // Par défaut, Web (Next.js = Web uniquement)
  return 'web';
}

/**
 * Vérifie si on est sur la plateforme Web
 */
export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Vérifie si on est sur la plateforme Mobile
 */
export function isMobile(): boolean {
  return getPlatform() === 'mobile';
}

/**
 * Helper pour exécuter du code uniquement sur Web
 */
export function onWeb<T>(callback: () => T, fallback?: T): T | undefined {
  if (isWeb()) {
    return callback();
  }
  return fallback;
}

