/**
 * Appels client vers les proxies Next — Structure académique & séries (Module 2)
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { withAcademicYearHeader } from '@/lib/api/year-header';
import { getUserScope } from '@/lib/auth/user-scope';

/**
 * ⭐ 2026-09-15 — header x-school-level-id pour les fetch pédagogie.
 * Réplique EXACTEMENT la logique de l'intercepteur axios (lib/api/client.ts) :
 *   1) priorité au UUID school_levels (sl.schoolLevelId) sur l'UUID
 *      education_levels (sl.id) — la VRAIE table attendue par le backend ;
 *   2) sentinelle 'ALL' réservée aux profils transverses : si le scope local
 *      indique un périmètre restreint, on ne l'envoie PAS (le scope serveur
 *      s'applique) — évite un 403 et garde la cohérence KPI/listes ;
 *   3) pas de niveau sélectionné → pas de header (périmètre serveur complet).
 * Sans ce header, les appels pedagogyFetch (matières, enseignants,
 * affectations, emplois du temps, sections) n'étaient PAS scopés par le
 * sélecteur de niveau du header — le directeur voyait TOUS les niveaux.
 */
function getSchoolLevelHeaderValue(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('schoolLevel');
    if (!raw) return null;
    const sl = JSON.parse(raw);
    if (!sl) return null;
    const levelHeaderValue = sl.schoolLevelId || sl.id;
    if (!levelHeaderValue || typeof levelHeaderValue !== 'string') return null;
    if (levelHeaderValue.toUpperCase() === 'ALL') {
      const scope = getUserScope();
      if (!scope || scope.allLevels !== false) return levelHeaderValue;
      return null; // périmètre restreint → pas de header (scope serveur)
    }
    return levelHeaderValue;
  } catch {
    return null;
  }
}

/** Headers de scope pédagogie : niveau sélectionné + année active. */
function withSchoolScopeHeaders(
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Record<string, string> {
  const out = withAcademicYearHeader(path, headers, body);
  const level = getSchoolLevelHeaderValue();
  if (level && !out['x-school-level-id']) {
    out['x-school-level-id'] = level;
  }
  return out;
}

export async function pedagogyFetch<T>(
  path: string,
  options?: { method?: string; body?: any; headers?: Record<string, string> },
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    // ⭐ FIX 2026-09-09 : header x-academic-year-id (année du sélecteur global)
    // ⭐ 2026-09-15 : + x-school-level-id (niveau du sélecteur global) — scope
    //    pédagogie cohérent avec les appels axios (directeurs/enseignants
    //    restreints à leur périmètre, promoteur voit tout).
    headers: withSchoolScopeHeaders(
      path,
      {
        ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...getClientAuthorizationHeader(),
        ...options?.headers,
      },
      options?.body,
    ),
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { 
      body: options.body instanceof FormData || typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body) 
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try {
        err = JSON.parse(text) as { message?: string; error?: string };
      } catch {
        err = {};
      }
    }
    const message = err.message ?? err.error ?? res.statusText ?? 'Erreur réseau';
    throw new Error(message);
  }
  if (!text.trim()) {
    return null as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse invalide du serveur');
  }
}

export function academicStructureUrl(
  subPath: string,
  query?: Record<string, string | undefined>,
) {
  const trimmed = subPath.replace(/^\//, '');
  const base = trimmed
    ? `/api/pedagogy/academic-structure/${trimmed}`
    : `/api/pedagogy/academic-structure`;
  if (!query) return base;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function academicSeriesUrl(
  subPath: string,
  query?: Record<string, string | undefined>,
) {
  const trimmed = subPath.replace(/^\//, '');
  const base = trimmed
    ? `/api/pedagogy/academic-series/${trimmed}`
    : `/api/pedagogy/academic-series`;
  if (!query) return base;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
