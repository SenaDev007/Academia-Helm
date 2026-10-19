/**
 * ============================================================================
 * NATIVE SESSION RESUME — reprise de session dans l'app Android (Capacitor)
 * ============================================================================
 *
 * PROBLÈME :
 *   L'app native démarre TOUJOURS sur server.url = https://academiahelm.com/portal
 *   (domaine racine). Or les tokens de session (accessToken / refreshToken /
 *   localStorage) vivent sur le SOUS-DOMAINE du tenant (ex :
 *   lepalmaresplus.academiahelm.com) — localStorage et cookies host-only sont
 *   isolés par origine. Au démarrage à froid, le domaine racine ne sait donc
 *   RIEN de la session ouverte : l'utilisateur doit repasser par le portail
 *   public (choix du portail → choix de l'école → login) à chaque ouverture
 *   de l'app.
 *
 * SOLUTION :
 *   Un cookie PARTAGÉ posé sur le domaine de base (.academiahelm.com) — le
 *   seul mécanisme de stockage lisible à la fois par le domaine racine et par
 *   les sous-domaines tenant. Il mémorise l'hôte tenant où la session vit.
 *
 *   Démarrage à froid : /portal (racine) lit le cookie → redirige directement
 *   vers https://{tenant}.academiahelm.com/app → AppGate valide la session :
 *     - session valide   → l'utilisateur retrouve son interface immédiatement
 *     - session expirée  → /login du tenant s'affiche (jamais de boucle :
 *                          /login ne redirige jamais vers /portal)
 *
 * POLITIQUE :
 *   - Écrit UNIQUEMENT dans la coquille native (isNativeApp) — le web
 *     navigateur garde son comportement actuel, inchangé.
 *   - Effacé à la déconnexion (clearClientSessionSync) → « session toujours
 *     ouverte par défaut, l'utilisateur peut se déconnecter lui-même ».
 *   - Durée : 365 jours (le cookie ne fait que mémoriser l'HÔTE, pas un token
 *     — aucune élévation de privilège ; la validité réelle de la session est
 *     toujours vérifiée côté serveur à la reprise).
 */

import { isNativeApp } from '@/lib/pwa/is-native-app';

/** Nom du cookie de reprise (partagé sur le domaine de base). */
const NATIVE_RESUME_COOKIE = 'ah_native_resume';

/** Validité du cookie de reprise : 1 an (renouvelé à chaque écriture). */
const NATIVE_RESUME_MAX_AGE_S = 365 * 24 * 60 * 60;

/** Sous-domaines qui n'hébergent jamais une session utilisateur. */
const RESERVED_HOSTS = new Set(['api', 'www', 'app', 'admin', 'cdn']);

export interface NativeResumeHint {
  /** Hôte tenant où vit la session (ex: lepalmaresplus.academiahelm.com). */
  host: string;
  /** Timestamp (ms) de la dernière écriture du hint. */
  ts: number;
}

/** Domaine de base dérivé de la config ou de l'hôte courant. */
function getBaseDomain(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (configured) {
    return configured.replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // host est déjà un sous-domaine du base domain → garder les 2 dernières composantes
    const parts = host.split('.');
    if (parts.length >= 2) {
      // Gérer les TLD composés (.com, .org — 2 composantes suffisent ici)
      return parts.slice(-2).join('.');
    }
  }
  return 'academiahelm.com';
}

/**
 * Vrai si l'hôte héberge une session utilisateur (sous-domaine tenant du
 * domaine de base, hors sous-domaines réservés et hors domaine racine).
 */
export function isTenantSessionHost(hostname: string): boolean {
  if (!hostname) return false;
  const base = getBaseDomain();
  if (hostname === base) return false;
  if (!hostname.endsWith(`.${base}`)) return false;
  const sub = hostname.slice(0, -(base.length + 1));
  if (!sub || sub.includes('.')) return false; // pas de multi-niveau
  if (RESERVED_HOSTS.has(sub)) return false;
  return true;
}

/**
 * Enregistre l'hôte tenant courant comme cible de reprise de session native.
 * Appelé après un login réussi et au montage du shell authentifié /app —
 * UNIQUEMENT dans la coquille native Capacitor. No-op silencieuse ailleurs.
 */
export function writeNativeResumeHint(): void {
  if (typeof window === 'undefined') return;
  if (!isNativeApp()) return;

  const host = window.location.hostname;
  if (!isTenantSessionHost(host)) return;

  try {
    const value = `${host}|${Date.now()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${NATIVE_RESUME_COOKIE}=${value}; Max-Age=${NATIVE_RESUME_MAX_AGE_S}` +
      `; path=/; domain=.${getBaseDomain()}; SameSite=Lax${secure}`;
  } catch {
    // document.cookie indisponible — best-effort
  }
}

/** Lit le hint de reprise (peu importe l'origine courante — cookie partagé). */
export function readNativeResumeHint(): NativeResumeHint | null {
  if (typeof window === 'undefined') return null;
  try {
    const row = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${NATIVE_RESUME_COOKIE}=`));
    if (!row) return null;
    const raw = row.split('=').slice(1).join('='); // valeur peut contenir '='
    const [host, ts] = raw.split('|');
    if (!host || !isTenantSessionHost(host)) return null;
    return { host, ts: ts ? parseInt(ts, 10) || 0 : 0 };
  } catch {
    return null;
  }
}

/** Efface le hint de reprise (déconnexion manuelle). No-op hors natif. */
export function clearNativeResumeHint(): void {
  if (typeof window === 'undefined') return;
  try {
    document.cookie =
      `${NATIVE_RESUME_COOKIE}=; Max-Age=0; path=/; domain=.${getBaseDomain()}`;
  } catch {
    // best-effort
  }
}
