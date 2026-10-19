/**
 * ============================================================================
 * DÉTECTION COQUILLE NATIVE (Capacitor) — app Android Academia Helm
 * ============================================================================
 *
 * Pourquoi : l'application Android (apps/mobile, coquille Capacitor) charge
 * le web LIVE dans un WebView. Le pont JavaScript Capacitor est injecté dans
 * toutes les pages des domaines autorisés (allowNavigation) → la variable
 * globale `window.Capacitor` existe dans le WebView mais PAS dans un
 * navigateur classique.
 *
 * Usage : masquer tout ce qui n'a pas de sens DANS l'app native déjà
 * installée — bannière « Installer l'application » (PWA), instructions
 * d'installation manuelle, etc. Ne PAS utiliser pour masquer le
 * Service Worker offline-first (au contraire : il reste actif dans le
 * WebView, c'est un avantage).
 *
 * Filet de sécurité : le marqueur `; wv)` du user-agent WebView Android
 * couvre le cas théorique d'un pont non encore injecté au moment du test.
 */

/** Vrai si la page courante tourne dans la coquille native Capacitor. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Pont Capacitor (voie officielle — injecté sur les domaines allowNavigation)
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }

  // Marqueur WebView Android dans l'UA (ex. « …Chrome/130.0.0.0 Mobile Safari… ; wv) »)
  try {
    if (/;\s*wv\)/.test(navigator.userAgent)) return true;
  } catch {
    /* navigator indisponible — contexte exotique, répondre faux */
  }

  return false;
}
