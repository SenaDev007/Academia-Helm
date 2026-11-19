/**
 * ============================================================================
 * MOBILE SESSION RESUME — reprise de session sur mobile (app Android + web)
 * ============================================================================
 *
 * PROBLÈME :
 *   L'app native démarre TOUJOURS sur server.url = https://academiahelm.com/portal
 *   (domaine racine) ; sur mobile web, l'utilisateur qui revient passe aussi
 *   par le portail central (choix école). Or les tokens de session
 *   (accessToken / refreshToken / localStorage) vivent sur le SOUS-DOMAINE du
 *   tenant (ex : lepalmaresplus.academiahelm.com) — localStorage et cookies
 *   host-only sont isolés par origine. Au démarrage à froid, le domaine racine
 *   ne sait donc RIEN de la session ouverte : l'utilisateur doit repasser par
 *   le portail public (choix du portail → choix de l'école → login) à chaque
 *   ouverture.
 *
 * SOLUTION :
 *   Un cookie PARTAGÉ posé sur le domaine de base (.academiahelm.com) — le
 *   seul mécanisme de stockage lisible à la fois par le domaine racine et par
 *   les sous-domaines tenant. Il mémorise l'hôte tenant où la session vit.
 *
 *   Démarrage à froid : /portal (racine) lit le cookie → redirige directement
 *   vers la PAGE INSTITUTIONNELLE de l'école (https://{tenant}.academiahelm.com/
 *   — retour promoteur nov. 2026 : « pour les prochaines fois, ce sera la page
 *   institutionnelle, la page principale institutionnelle de l'école qui doit
 *   s'afficher »). Depuis cette page, l'utilisateur accède à l'application
 *   (portails → /login → session valide → /app) SANS ressaisir ses
 *   identifiants — jamais déconnecté.
 *
 * POLITIQUE (nov. 2026 — étendue au web mobile) :
 *   - Écrit sur TÉLÉPHONE (app native Capacitor OU navigateur mobile) — le
 *     desktop web garde son comportement actuel, inchangé.
 *   - Effacé à la déconnexion (clearClientSessionSync) → « session toujours
 *     ouverte par défaut, l'utilisateur peut se déconnecter lui-même ».
 *   - Durée : 365 jours (le cookie ne fait que mémoriser l'HÔTE, pas un token
 *     — aucune élévation de privilège ; la validité réelle de la session est
 *     toujours vérifiée côté serveur à la reprise).
 */

import { isMobileDevice } from '@/lib/pwa/mobile-experience';

/** Nom du cookie de reprise (partagé sur le domaine de base). */
const NATIVE_RESUME_COOKIE = 'ah_native_resume';

/** Clé localStorage (racine) — redondance si le cookie WebView est perdu/évincé. */
const ROOT_RESUME_LS_KEY = 'ah_resume_host';

/** Validité du cookie de reprise : 1 an (renouvelé à chaque écriture). */
const NATIVE_RESUME_MAX_AGE_S = 365 * 24 * 60 * 60;

/**
 * Sous-domaines qui n'hébergent jamais une session utilisateur ou dont la
 * racine n'est PAS la page institutionnelle d'une école (satellites portails,
 * back-office, api). ⭐ V12b : les satellites (teacher/enseignant/
 * saisiemaster/academiafederis) ajoutés — ils hébergent des sessions mais leur
 * racine n'est pas le site institutionnel d'une école.
 */
const RESERVED_HOSTS = new Set([
  'api', 'www', 'app', 'admin', 'cdn',
  'teacher', 'enseignant', 'saisiemaster', 'academiafederis', 'federis',
]);

/** Durée de vie des hints localStorage (js) : 365 j. */
const ROOT_RESUME_LS_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

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
 * Enregistre l'hôte tenant courant comme cible de reprise de session mobile.
 * Appelé après un login réussi et au montage du shell authentifié /app —
 * UNIQUEMENT sur téléphone (coquille native Capacitor OU navigateur mobile).
 * No-op silencieuse ailleurs (desktop web inchangé).
 */
export function writeNativeResumeHint(): void {
  if (typeof window === 'undefined') return;
  if (!isMobileDevice()) return;

  const host = window.location.hostname;
  if (!isTenantSessionHost(host)) return;

  writeResumeHintCookie(host);
}

/**
 * ⭐ V12b (retour promoteur 2026-11-19 : « 2e ouverture = page institutionnelle »
 *    ne se produisait pas — le cookie WebView est la seule persistance et il
 *    peut être évincé/perdu) : écrit le hint de reprise POUR UN HÔTE EXPLICITE
 *    depuis la page COURANTE — cookie partagé .academiahelm.com + localStorage
 *    de l'origine courante (redondance). Utilisé :
 *      - par /portal au moment de REDIRIGER vers une école (sélection d'école :
 *        le premier usage mémorise l'école — même si le login n'a pas encore eu
 *        lieu, le hint sera là pour les démarrages suivants) ;
 *      - par le redirectToTenant utilitaire (toute sélection d'école).
 *    Pas de garde isMobileDevice ici : la LECTURE est réservée au mobile, la
 *    présence du hint ne change rien au desktop (flux portail normal).
 */
export function writeResumeHint(host: string): void {
  if (typeof window === 'undefined') return;
  if (!isTenantSessionHost(host)) return;
  writeResumeHintCookie(host);
  try {
    window.localStorage.setItem(
      ROOT_RESUME_LS_KEY,
      JSON.stringify({ host, ts: Date.now() }),
    );
  } catch {
    // localStorage indisponible — le cookie reste
  }
}

/** Écrit le cookie de reprise pour l'hôte donné (depuis n'importe quel
 *  sous-domaine du domaine de base). */
function writeResumeHintCookie(host: string): void {
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
    if (!row) return readRootResumeHintLS();
    const raw = row.split('=').slice(1).join('='); // valeur peut contenir '='
    const [host, ts] = raw.split('|');
    if (!host || !isTenantSessionHost(host)) return readRootResumeHintLS();
    return { host, ts: ts ? parseInt(ts, 10) || 0 : 0 };
  } catch {
    return readRootResumeHintLS();
  }
}

/** ⭐ V12b — Repli localStorage racine (origine courante). Le localStorage
 *    du domaine racine survit de façon très robuste dans le WebView Android
 *    (contrairement au cookie, évincable par le GC de Chromium). */
function readRootResumeHintLS(): NativeResumeHint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ROOT_RESUME_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { host?: string; ts?: number };
    if (!parsed.host || !isTenantSessionHost(parsed.host)) return null;
    // Hint périmé (1 an) → ignorer silencieusement
    if (parsed.ts && Date.now() - parsed.ts > ROOT_RESUME_LS_MAX_AGE_MS) return null;
    return { host: parsed.host, ts: parsed.ts || 0 };
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
  // ⭐ V12b — effacer AUSSI le localStorage racine (redondance V12b)
  try {
    window.localStorage.removeItem(ROOT_RESUME_LS_KEY);
  } catch {
    // best-effort
  }
}
