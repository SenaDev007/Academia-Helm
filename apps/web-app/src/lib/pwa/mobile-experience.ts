/**
 * ============================================================================
 * MOBILE EXPERIENCE — Politique UX unifiée pour les appareils mobiles
 * ============================================================================
 *
 * ⭐ MOTIVATION (retour promoteur, nov. 2026) : la version mobile (app Android
 *    Capacitor + navigateurs mobiles Chrome/Samsung) doit se comporter comme
 *    une vraie application mobile (référence : WhatsApp) :
 *      - session TOUJOURS ouverte (aucune déconnexion automatique) ;
 *      - navigation entre modules instantanée/fluide (jamais de loading sans
 *        fin pour un contenu déjà consulté) ;
 *      - AUCUNE sollicitation d'installation PWA (l'app native existe — la
 *        demande est incohérente sur téléphone) ;
 *      - modal de conflits de sync discret (jamais une fenêtre qui revient
 *        toutes les 30 s) ;
 *      - après la 1re connexion + sélection de l'école, chaque démarrage
 *        atterrit sur la page institutionnelle de l'école.
 *
 * ⭐ POLITIQUE : tout ce qui est vrai pour la coquille native Capacitor
 *    (isNativeApp) l'est AUSSI pour un navigateur sur téléphone. Le desktop
 *    web garde strictement son comportement actuel (verrouillage 15 min,
 *    expiration 45 min, bannière d'installation PWA, flux portail standard).
 *
 * Détection UA (user-agent) — mobile si :
 *   - iPhone / iPod / iPad (Safari iOS, Chrome iOS inclus), OU
 *   - Android + marqueur « Mobile » (le UA téléphone Android contient TOUJOURS
 *     « Mobile » ; les tablettes Android ne l'ont pas → traitées comme desktop,
 *     choix conservateur), OU
 *   - marqueur WebView Android « ; wv) » / « capacitor » (app native).
 * Un navigateur desktop ne contient JAMAIS ces combinaisons.
 * SSR-safe : retourne false côté serveur (window absent).
 */

import { isNativeApp } from './is-native-app';

/**
 * Vrai si le user-agent donné ressemble à un TÉLÉPHONE.
 * (Fonction pure — utilisable côté client, côté serveur Node et dans le SW.)
 */
export function uaLooksMobile(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  // App native Capacitor (WebView Android : marqueurs « ; wv) » / « capacitor »)
  if (/;\s*wv\)/.test(userAgent) || /capacitor/i.test(userAgent)) return true;
  // iOS : iPhone / iPod / iPad
  if (/iPhone|iPod|iPad/i.test(userAgent)) return true;
  // Android TÉLÉPHONE : « Android » ET « Mobile » dans le même UA
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return true;
  return false;
}

/** Vrai si la page tourne sur un téléphone (navigateur mobile OU app native). */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return true; // coquille Capacitor — toujours mobile
  try {
    return uaLooksMobile(navigator.userAgent);
  } catch {
    return false;
  }
}

/**
 * Vrai si la session courante doit suivre la politique « toujours ouverte »
 * (app native OU navigateur sur téléphone). C'est le point d'entrée unique
 * pour : verrouillage d'inactivité, expiration auto, refresh 90 jours,
 * cookie de reprise, redirection institutionnelle.
 */
export function isAlwaysOnMobileSession(): boolean {
  return isMobileDevice();
}

/**
 * Variante STRICTEMENT UA (sans test Capacitor window) — pour le Service
 * Worker et les contextes serveur où seul l'UA de la requête est disponible.
 */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return uaLooksMobile(userAgent);
}
