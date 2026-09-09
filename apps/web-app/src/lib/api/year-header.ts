/**
 * ============================================================================
 * YEAR HEADER — Injection du header x-academic-year-id pour les clients fetch
 * ============================================================================
 *
 * ⭐ FIX 2026-09-09 (« bascule d'année globale dans tous les modules ») :
 *
 * PROBLÈME : seul le client Axios (`lib/api/client.ts`) injecte le header
 * `x-academic-year-id` (depuis localStorage `academicYear`). Les wrappers
 * fetch natifs (financeFetch, hrFetch, pedagogyFetch, steFetch…) ne
 * l'envoient PAS → pour les URLs SANS `academicYearId` explicite, le BFF et
 * le backend retombaient sur l'année ACTIVE serveur (2026-2027) au lieu de
 * l'année sélectionnée dans le header (ex: 2025-2026) → données incohérentes
 * après le switch d'année.
 *
 * SOLUTION : ce helper lit l'année persistée par AcademicYearContext
 * (localStorage `academicYear`) et injecte `x-academic-year-id` — SEULEMENT
 * si la requête ne porte pas DÉJÀ son année (query `academicYearId=` dans le
 * path, ou champ `academicYearId` dans le body). On évite ainsi tout conflit
 * avec l'AcademicYearEnforcementInterceptor backend, qui REJETTE
 * (500) une requête dont query/body et header désigneraient des années
 * différentes (ex: modales « copier vers une autre année » qui visent
 * volontairement une année ≠ année courante).
 *
 * Le header traverse le proxy BFF (`lib/api/proxy-auth.ts` le relaie) puis
 * est appliqué serveur par AcademicYearEnforcementInterceptor (injection
 * query/body si absent) et par les services qui le lisent.
 */

/** Lit l'ID d'année persisté par AcademicYearContext (localStorage). */
export function getPersistedAcademicYearId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('academicYear');
    if (!raw) return null;
    const ay = JSON.parse(raw) as { id?: string };
    return ay?.id && typeof ay.id === 'string' ? ay.id : null;
  } catch {
    return null;
  }
}

/**
 * Injecte `x-academic-year-id` dans les headers d'une requête fetch/axios
 * si (et seulement si) la requête ne spécifie pas déjà son année.
 *
 * @param path    URL appelée (peut contenir ?academicYearId=…)
 * @param headers headers existants (non modifiés — une copie est retournée)
 * @param body    body éventuel (objet avec champ academicYearId possible)
 */
export function withAcademicYearHeader(
  path: string,
  headers: Record<string, string>,
  body?: any,
): Record<string, string> {
  if (typeof window === 'undefined') return headers;
  if (headers['x-academic-year-id']) return headers;
  // Déjà une année explicite dans l'URL ? → ne pas injecter (évite le
  // rejet 500 de l'AcademicYearEnforcementInterceptor sur mismatch).
  if (/academicYearId=/i.test(path)) return headers;
  // Déjà une année explicite dans le body (objet JSON) ? → idem.
  if (
    body &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    'academicYearId' in body &&
    (body as any).academicYearId
  ) {
    return headers;
  }
  const yearId = getPersistedAcademicYearId();
  if (!yearId) return headers;
  return { ...headers, 'x-academic-year-id': yearId };
}
