/**
 * Années scolaires pour le header = données réelles (Paramètres).
 * L'année active (isActive en BDD) est exposée en isCurrent pour que le sélecteur l'affiche par défaut.
 *
 * ⭐ FIX 2026-09-14 « sélecteur année scolaire bloqué » :
 *   - AVANT : le fetch vers Nest n'avait AUCUN timeout et les réponses en
 *     erreur (401 JWT expiré, 5xx) étaient converties en `[]` avec statut
 *     200 → le sélecteur affichait « Aucune année scolaire » (rouge) ou
 *     restait en « Chargement... » indéfini (requête pendante), SANS retry.
 *   - MAINTENANT : timeout 15 s (pattern standardisé) + statut backend
 *     propagé (le hook du header retrye via React Query ; les composants
 *     legacy `Array.isArray ? : []` gardent leur comportement liste vide)
 *     + 502 explicite en cas d'erreur interne.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(normalizeApiUrl(`${API_BASE_URL}/settings/academic-years`));
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);

    // ⭐ Timeout 15 s (avant : aucun → requête pendante → chargement infini)
    const response = await fetchWithTimeout(url.toString(), { headers }, 15000);

    // ⭐ Propager le statut d'erreur backend (401 JWT expiré, 403, 5xx…) au
    //    lieu de renvoyer [] 200 : le client peut alors rafraîchir son token
    //    et retryer (authFetch) au lieu de croire à un vide confirmé.
    if (!response.ok) {
      return NextResponse.json(
        { error: 'upstream_error', message: `Années scolaires: HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => [])
      : [];
    const years = Array.isArray(data) ? data : [];
    const mapped = years.map((y: { id: string; name: string; startDate?: string; endDate?: string; isActive?: boolean; admissionEnabled?: boolean; admissionOpenDate?: string; admissionCloseDate?: string; [k: string]: unknown }) => ({
      id: y.id,
      name: y.name,
      startDate: y.startDate ?? '',
      endDate: y.endDate ?? '',
      isCurrent: Boolean(y.isActive),
      // ⭐ Paramètres d'admission publique (portail public).
      // Sans ces champs, l'onglet Admissions > Paramétrage ne peut pas recharger
      // les valeurs sauvegardées — elles apparaissent vides après rechargement.
      admissionEnabled: y.admissionEnabled !== false,
      admissionOpenDate: y.admissionOpenDate ?? null,
      admissionCloseDate: y.admissionCloseDate ?? null,
    }));
    return NextResponse.json(mapped, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error fetching academic years:', error);
    // ⭐ 502 explicite (plus de [] 200 silencieux qui figeait le sélecteur)
    return NextResponse.json(
      { error: 'internal_error', message: 'Chargement des années scolaires impossible' },
      { status: 502 },
    );
  }
}
