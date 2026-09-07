/**
 * ============================================================================
 * API ROUTE — Toutes les classes du tenant (sans filtrage schoolLevelId)
 * ============================================================================
 *
 * Route BFF dédiée pour récupérer les classes du tenant courant pour les
 * sélecteurs de classe (modale encaissement, admissions…).
 *
 * Pourquoi cette route existe :
 *   - /api/classes utilise @Query() pagination: PaginationDto avec
 *     forbidNonWhitelisted: true → le param schoolLevelId=ALL est rejeté (400)
 *   - On ne peut pas modifier le PaginationDto globalement
 *   - Cette route contourne le problème en appelant directement le backend
 *     avec le header x-school-level-id=ALL (comptes transverses)
 *
 * ⭐ FIX 2026-09-07 « sélecteur de classe vide » (modale encaissement) :
 *   La route envoyait x-school-level-id=ALL sur TOUTES les requêtes. Le
 *   AccessScopeGuard global (backend) réserve la sentinelle ALL aux profils
 *   transverses (promoteur…) → 403 pour tout compte à périmètre restreint
 *   (secrétaire, secrétaire-comptable, comptable, directeur de niveau…) →
 *   le BFF masquait le 403 en renvoyant [] → sélecteur de classe VIDE dans
 *   la modale encaissement (module Finance > onglet Encaissement).
 *   → Pour ces comptes, on résout le scope via /context/bootstrap et on
 *   interroge /classes pour CHAQUE niveau du périmètre (header spécifique,
 *   jamais la sentinelle ALL). Les comptes transverses gardent le
 *   comportement historique (ALL).
 *
 * Utilisé par :
 *   - NewPaymentModal.tsx (sélecteur de classe de la modale encaissement)
 *   - AdmissionsContent.tsx (affichage getClassLabel)
 *   - AdmissionForm.tsx (select de classe en édition)
 *
 * GET /api/all-classes
 *   → Response: [{ id, name, code, schoolLevelId, schoolLevel: {id, name, code} }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

/**
 * Parse la réponse backend paginée ou plate en liste.
 */
async function parseList(res: Response | null): Promise<any[]> {
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data) ? data : (data?.data || data?.items || []);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headers = await getProxyAuthHeaders(request);

    // ─── Résolution de l'année scolaire (comme avant) ───────────────────────
    //    Ordre : query param > header x-academic-year-id > année active.
    let academicYearId = searchParams.get('academicYearId')
      || request.headers.get('x-academic-year-id')
      || '';

    if (!academicYearId) {
      try {
        const yearRes = await fetch(normalizeApiUrl(`${API_URL}/settings/academic-years/active`), {
          headers,
          cache: 'no-store',
        });
        if (yearRes.ok) {
          const yearData = await yearRes.json();
          const yearObj = yearData?.data || yearData;
          academicYearId = yearObj?.id || yearObj?.academicYearId || '';
        }
      } catch (e) {
        console.warn('[BFF all-classes] Failed to resolve active academic year:', e);
      }
    }

    // ─── Scope serveur (Rôles × Pistes × Niveaux) — en parallèle ────────────
    // Indispensable pour les comptes à périmètre restreint : la sentinelle
    // x-school-level-id=ALL leur est interdite (AccessScopeGuard → 403).
    let scope: { levelCodes?: string[]; levelIds?: string[]; allLevels?: boolean } | null = null;
    try {
      const bootstrapRes = await fetchWithTimeout(
        normalizeApiUrl(`${API_URL}/context/bootstrap`),
        { headers, cache: 'no-store' },
        15000,
      );
      if (bootstrapRes.ok) {
        const bootstrapData = await bootstrapRes.json().catch(() => ({}));
        scope = bootstrapData?.scope ?? null;
      }
    } catch {
      scope = null;
    }

    const isRestrictedScope =
      !!scope &&
      scope.allLevels === false &&
      Array.isArray(scope.levelIds) &&
      scope.levelIds.length > 0;

    let classes: any[] = [];

    if (isRestrictedScope && scope?.levelIds) {
      // ─── Compte à périmètre restreint (secrétaire, comptable…) ───────────
      // Interroger /classes pour CHAQUE niveau du périmètre avec le header
      // spécifique (autorisé par le guard : l'UUID est dans scope.levelIds).
      // ⭐ Maternelle+Primaire fused → MAT_PRI n'est pas un UUID : on filtre
      //    les valeurs non-UUID (le scope expose les UUIDs réels à côté).
      const levelUuids = Array.from(new Set(scope.levelIds.filter((id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      )));

      const perLevel = await Promise.all(
        levelUuids.map((levelId: string) => {
          const url = new URL(`${API_URL}/classes`);
          url.searchParams.append('limit', '100');
          if (academicYearId) url.searchParams.set('academicYearId', academicYearId);
          const levelHeaders = { ...headers, 'x-school-level-id': levelId };
          return fetchWithTimeout(normalizeApiUrl(url.toString()), { headers: levelHeaders, cache: 'no-store' }, 15000)
            .catch(() => null);
        })
      );

      const lists = await Promise.all(perLevel.map((r) => parseList(r)));
      const seen = new Set<string>();
      for (const list of lists) {
        for (const c of list) {
          if (c?.id && !seen.has(c.id)) {
            seen.add(c.id);
            classes.push(c);
          }
        }
      }

      // ⭐ Défense en profondeur : restreindre aux niveaux du périmètre
      //    (le guard côté backend a déjà validé, mais on garde ce filtre
      //    pour les réponses backend hors-norme).
      const scopeLevelIds = new Set(scope.levelIds);
      classes = classes.filter(
        (c: any) => !c.schoolLevelId || scopeLevelIds.has(c.schoolLevelId)
      );
    } else {
      // ─── Compte transverse (promoteur…) : comportement historique ────────
      const url = new URL(`${API_URL}/classes`);
      url.searchParams.append('limit', '100');
      if (academicYearId) url.searchParams.set('academicYearId', academicYearId);

      const allHeaders = { ...headers, 'x-school-level-id': 'ALL' };
      const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers: allHeaders, cache: 'no-store' }, 15000);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.warn('[BFF all-classes] Backend returned', response.status, JSON.stringify(data));
        return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-cache' } });
      }
      classes = await parseList(response);
    }

    // ⭐ Defense-in-depth : filtrer côté BFF les classes dont l'officialClass
    //    est inactive (grade désactivé dans Paramètres > Structure).
    //    Le backend fait déjà ce filtre (classes.repository.ts findAll),
    //    mais on l'ajoute ici pour être 100% sûr qu'aucune classe désactivée
    //    ne remonte dans les sélecteurs, même si une route alternative
    //    ou un cache stale contourne le filtre backend.
    const filteredClasses = classes.filter((c: any) => {
      // Classes legacy sans officialClassId → conservées
      if (!c.officialClassId) return true;
      // Classes avec officialClass → ne garder que si active
      if (c.officialClass && c.officialClass.isActive === false) return false;
      return true;
    });

    // Cache 60s (les classes changent rarement) + stale-while-revalidate 5min
    return NextResponse.json(filteredClasses, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching all-classes:', error);
    return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-cache' } });
  }
}
