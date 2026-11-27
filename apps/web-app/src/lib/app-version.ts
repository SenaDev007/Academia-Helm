/**
 * ============================================================================
 * VERSION APPLICATIVE & COPYRIGHT — SOURCE UNIQUE DYNAMIQUE (2026-11-27)
 * ============================================================================
 *
 * ⭐ Demande promoteur : « la version et le copyright doivent être dynamiques
 *    et automatiques, pas codés en dur » (footer de l'application + footer du
 *    site public acadiahelm.com).
 *
 * AVANT : le footer de /app affichait « v1.0.0 » figé (alors que la version
 * réelle était 1.0.57+) et « © 2021-2026 » gravé en dur.
 *
 * MAINTENANT :
 *   1. VERSION — deux sources, une seule vérité :
 *      - Bundled : apps/web-app/package.json → "version" (bump à chaque
 *        livraison, en synchro avec apps/api-server/src/app.controller.ts) ;
 *      - Runtime : GET {API_BASE_URL}/health (route publique Nest) qui expose
 *        la version RÉELLEMENT DÉPLOYÉE de l'API + le commit git Railway.
 *      Le hook useAppVersion() affiche la version bundlée instantanément
 *      (zéro flash, zéro mismatch d'hydratation), puis la remplace par la
 *      version runtime si l'API répond (cache localStorage 1 h).
 *
 *   2. COPYRIGHT — l'année est TOUJOURS calculée à l'exécution :
 *      getCopyrightRange() → « 2021-2027 » etc. Plus jamais de millésime figé.
 *
 * ⚠️ CONVENTION ÉQUIPE : à chaque livraison, bumper ENSEMBLE :
 *      apps/web-app/package.json           → "version"
 *      apps/api-server/package.json        → "version"
 *      apps/api-server/src/app.controller  → version du /health
 *    (les trois sont vérifiables d'un coup d'œil sur /health et le footer).
 */

import pkg from '../../package.json';
import { API_BASE_URL } from './api-config';

/** Version embarquée au build (package.json du web-app). */
export const BUNDLED_APP_VERSION: string = pkg.version ?? '1.0.0';

/** Première année d'exploitation de la plateforme (YEHI OR Tech). */
export const COPYRIGHT_START_YEAR = 2021;

/** Propriétaire du copyright. */
export const COPYRIGHT_OWNER = 'YEHI OR Tech';

/**
 * Année(s) du copyright, calculée à l'exécution :
 * « 2021-2026 » (ou simplement « 2026 » si l'année de départ == année courante).
 */
export function getCopyrightRange(startYear: number = COPYRIGHT_START_YEAR): string {
  const current = new Date().getFullYear();
  return current > startYear ? `${startYear}-${current}` : `${startYear}`;
}

/** Libellé complet du copyright : « © 2021-2026 YEHI OR Tech ». */
export function getCopyrightLabel(): string {
  return `© ${getCopyrightRange()} ${COPYRIGHT_OWNER}`;
}

export interface AppVersionInfo {
  version: string;
  commit?: string;
  /** D'où vient l'information affichée. */
  source: 'runtime-api' | 'bundled';
  fetchedAt?: number;
}

const CACHE_KEY = 'ah_app_version_info_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure
const FETCH_TIMEOUT_MS = 6000;

function readCache(): AppVersionInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppVersionInfo;
    if (!parsed?.version) return null;
    // Cache périmé → on l'ignore (mais on garde la valeur pour l'affichage
    // instantané, la révalidation tourne en tâche de fond).
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(info: AppVersionInfo) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(info));
  } catch {
    // localStorage indisponible (mode privé…) — non bloquant.
  }
}

function isCacheFresh(info: AppVersionInfo | null): boolean {
  return !!info?.fetchedAt && Date.now() - info.fetchedAt < CACHE_TTL_MS;
}

/**
 * Version applicative : interroge la route publique /health de l'API
 * (version réellement déployée + commit Railway). Retombe toujours sur la
 * version bundlée si l'API ne répond pas (jamais d'échec bloquant).
 */
export async function fetchAppVersion(): Promise<AppVersionInfo> {
  if (typeof window === 'undefined') {
    return { version: BUNDLED_APP_VERSION, source: 'bundled' };
  }

  const cached = readCache();
  if (isCacheFresh(cached)) return cached!;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { version?: string; commit?: string };
      if (data?.version) {
        const info: AppVersionInfo = {
          version: String(data.version),
          commit: data.commit || undefined,
          source: 'runtime-api',
          fetchedAt: Date.now(),
        };
        writeCache(info);
        return info;
      }
    }
  } catch {
    // API injoignable / offline → fallback silencieux ci-dessous.
  }

  // Échec réseau : on garde la dernière version runtime connue si elle existe
  // (meilleure approximation que la version bundlée), sinon la bundlée.
  return cached ?? { version: BUNDLED_APP_VERSION, source: 'bundled' };
}

/**
 * Version affichable immédiatement au premier rendu (sans await) :
 * cache localStorage s'il existe, sinon version bundlée.
 */
export function getInitialAppVersion(): AppVersionInfo {
  if (typeof window !== 'undefined') {
    const cached = readCache();
    if (cached) return cached;
  }
  return { version: BUNDLED_APP_VERSION, source: 'bundled' };
}
