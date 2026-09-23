/**
 * ============================================================================
 * API ROUTE: WEIGHTED AVERAGE — Proxy vers le backend NestJS
 * ============================================================================
 *
 * ⭐ Avant : cette route retournait des données MOCK (`14.5`, `[T1:13.2, T2:14.0, T3:14.5]`).
 *    Le dashboard "Évolution des moyennes par trimestre" était donc faux.
 *
 * ⭐ Maintenant : proxy réel vers NestJS `/general/weighted-average`.
 *    Si le backend ne répond pas ou retourne 404, on tombe sur un fallback
 *    vide (le LineChartCard affiche "Aucune donnée disponible" au lieu de
 *    données fictives).
 *
 *    Le backend NestJS peut retourner :
 *      - { weightedAverage: number, evolution: [{ period: 'T1', value: 13.2 }, ...] }
 *      - Ou { average: number, byPeriod: [...] } (formats historiques)
 *      - On normalise les deux.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');

    // Construire l'URL backend
    const backendUrl = new URL(`${getApiBaseUrlForRoutes()}/general/weighted-average`);
    if (academicYearId) backendUrl.searchParams.append('academicYearId', academicYearId);
    if (schoolLevelId) backendUrl.searchParams.append('schoolLevelId', schoolLevelId);

    const headers = await getProxyAuthHeaders(request);

    try {
      const response = await fetchWithTimeout(
        normalizeApiUrl(backendUrl.toString()),
        { headers, cache: 'no-store' },
        10000,
      );

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data && typeof data === 'object') {
          // ⭐ Normaliser le format : accepter plusieurs noms de champs
          const weightedAverage = data.weightedAverage ?? data.average ?? data.value ?? null;
          const evolution = Array.isArray(data.evolution)
            ? data.evolution
            : Array.isArray(data.byPeriod)
              ? data.byPeriod
              : Array.isArray(data.periods)
                ? data.periods
                : [];

          const normalizedEvolution = evolution.map((p: any) => ({
            period: p.period || p.label || p.name || '—',
            value: typeof p.value === 'number'
              ? p.value
              : typeof p.average === 'number'
                ? p.average
                : 0,
          }));

          return NextResponse.json({
            weightedAverage,
            evolution: normalizedEvolution,
            bilingualComparison: data.bilingualComparison || data.bilingual || null,
            academicYearId: academicYearId || data.academicYearId,
            schoolLevelId: schoolLevelId || data.schoolLevelId,
          }, {
            status: 200,
            headers: { 'Cache-Control': 'private, no-store' },
          });
        }
      }
      // Si 404 ou autre → fallback vide (pas de mock)
    } catch (backendError) {
      console.warn('[weighted-average] Backend unreachable:', (backendError as Error).message);
    }

    // ⭐ Fallback : AUCUNE donnée fictive. Le dashboard affichera
    //    "Aucune donnée disponible" au lieu de montrer de faux chiffres.
    return NextResponse.json({
      weightedAverage: null,
      evolution: [],
      bilingualComparison: null,
      academicYearId: academicYearId || null,
      schoolLevelId: schoolLevelId || null,
      _fallback: 'backend-unavailable',
    }, { status: 200 });
  } catch (error) {
    console.error('Error in weighted-average route:', error);
    return NextResponse.json(
      { weightedAverage: null, evolution: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
