/**
 * ============================================================================
 * API ROUTE: /api/dashboard/grade-evolution
 * ============================================================================
 *
 * Évolution des moyennes par période (trimestre), par niveau scolaire, et par
 * piste linguistique (FR / EN).
 *
 * Retourne une structure multi-séries pour alimenter le graphique :
 * {
 *   periods: ['T1', 'T2', 'T3'],
 *   series: [
 *     {
 *       levelCode: 'MATERNELLE',
 *       levelLabel: 'Maternelle',
 *       track: 'FR',
 *       scale: 'qualitative',  // 'qualitative' (maternelle FR) | '/20' | '/100'
 *       data: [{ period: 'T1', value: 13.2 }, { period: 'T2', value: 14.0 }, ...]
 *     },
 *     {
 *       levelCode: 'PRIMAIRE',
 *       levelLabel: 'Primaire',
 *       track: 'FR',
 *       scale: '/20',
 *       data: [...]
 *     },
 *     {
 *       levelCode: 'SECONDAIRE',
 *       levelLabel: 'Secondaire',
 *       track: 'FR',
 *       scale: '/20',
 *       data: [...]
 *     },
 *     // Si bilingue activé :
 *     {
 *       levelCode: 'MATERNELLE',
 *       levelLabel: 'Maternelle',
 *       track: 'EN',
 *       scale: '/100',  // anglophone = toujours /100
 *       data: [...]
 *     },
 *     {
 *       levelCode: 'PRIMAIRE',
 *       levelLabel: 'Primaire',
 *       track: 'EN',
 *       scale: '/100',
 *       data: [...]
 *     },
 *     {
 *       levelCode: 'SECONDAIRE',
 *       levelLabel: 'Secondaire',
 *       track: 'EN',
 *       scale: '/100',
 *       data: [...]
 *     },
 *   ]
 * }
 *
 * ⭐ Stratégie :
 *    1. Appelle /general/weighted-average (qui retourne déjà byLevel[] avec averages)
 *    2. Appelle /exams/averages ou /exams/rankings pour récupérer les moyennes
 *       par période (via student_period_averages agrégées par periodId)
 *    3. Vérifie settings_bilingual pour savoir si on doit séparer FR/EN
 *
 * ⭐ Si le backend ne supporte pas encore la décomposition par période, on
 *    retourne un tableau vide (le frontend affichera "Aucune donnée disponible"
 *    plutôt que de montrer de fausses données).
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];

interface PeriodValue {
  period: string;
  value: number;
}

interface GradeSeries {
  levelCode: string;
  levelLabel: string;
  track: 'FR' | 'EN';
  scale: 'qualitative' | '/20' | '/100';
  data: PeriodValue[];
}

interface GradeEvolutionResponse {
  periods: string[];
  series: GradeSeries[];
  bilingualEnabled: boolean;
  _source: 'ok' | 'partial' | 'empty';
}

function getLevelLabel(code: string): string {
  const map: Record<string, string> = {
    MATERNELLE: 'Maternelle',
    PRIMAIRE: 'Primaire',
    SECONDAIRE: 'Secondaire',
    COLLEGE: 'Collège',
    LYCEE: 'Lycée',
  };
  return map[code] || code;
}

function getScaleForLevelTrack(levelCode: string, track: 'FR' | 'EN'): 'qualitative' | '/20' | '/100' {
  if (track === 'EN') return '/100'; // Anglophone = toujours /100
  if (levelCode === 'MATERNELLE') return 'qualitative'; // Maternelle FR = qualitatif
  return '/20'; // Primaire + Secondaire FR = /20
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId is required' },
        { status: 400 },
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // ─── 1. Vérifier si le bilingue est activé ─────────────────────────────
    let bilingualEnabled = false;
    try {
      const url = new URL(`${baseUrl}/settings/bilingual`);
      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        5000,
      ).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        bilingualEnabled = !!(data?.isEnabled || data?.bilingual?.isEnabled);
      }
    } catch {
      // Si on ne peut pas récupérer, on suppose non-bilingue
    }

    // ─── 2. Récupérer les périodes (quarters) de l'année académique ─────────
    let periods: Array<{ id: string; name: string; number: number }> = [];
    try {
      const url = new URL(`${baseUrl}/quarters`);
      url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        8000,
      ).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data) ? data : (data?.items || data?.quarters || []);
        periods = list
          .filter((q: any) => q && q.id)
          .sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
          .map((q: any) => ({
            id: q.id,
            name: q.name || `T${q.number || '?'}`,
            number: q.number || 0,
          }));
      }
    } catch {
      // Pas grave — on utilisera des périodes génériques
    }

    // Périodes fallback si le backend ne retourne rien
    if (periods.length === 0) {
      periods = [
        { id: 't1', name: 'T1', number: 1 },
        { id: 't2', name: 'T2', number: 2 },
        { id: 't3', name: 'T3', number: 3 },
      ];
    }

    // ─── 3. Récupérer les moyennes par niveau via /general/weighted-average ─
    //    Cet endpoint retourne déjà byLevel[] avec { levelId, levelName, value, average }
    let weightedAvgByLevel: Array<{ levelCode: string; levelName: string; average: number }> = [];
    try {
      const url = new URL(`${baseUrl}/general/weighted-average`);
      url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        10000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const byLevel = data?.byLevel || [];
        weightedAvgByLevel = byLevel.map((l: any) => ({
          levelCode: (l.levelCode || l.code || '').toUpperCase(),
          levelName: l.levelName || l.name || l.label || '',
          average: l.average ?? l.value ?? 0,
        }));
      }
    } catch (e) {
      console.warn('[grade-evolution] weighted-average fetch failed:', (e as Error).message);
    }

    // ─── 4. Pour chaque période, récupérer les moyennes par niveau ──────────
    //    On appelle /exams/averages?periodId=X&academicYearId=Y pour chaque période.
    //    Cet endpoint retourne (potentiellement) les moyennes agrégées par niveau.
    //    ⭐ Si l'endpoint n'existe pas ou ne retourne rien, on met des zéros.
    const periodAverages: Record<string, Array<{ levelCode: string; track: 'FR' | 'EN'; average: number }>> = {};

    for (const period of periods) {
      periodAverages[period.id] = [];

      try {
        const url = new URL(`${baseUrl}/exams/averages`);
        url.searchParams.append('academicYearId', academicYearId);
        url.searchParams.append('periodId', period.id);
        url.searchParams.append('groupBy', 'level');

        const res = await fetchWithTimeout(
          normalizeApiUrl(url.toString()),
          { headers, cache: 'no-store' },
          6000,
        ).catch(() => null);

        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          // Format attendu : [{ levelCode, levelName, average, track }] ou { byLevel: [...] }
          const list = Array.isArray(data) ? data : (data?.byLevel || data?.items || data?.averages || []);
          for (const item of list) {
            periodAverages[period.id].push({
              levelCode: (item.levelCode || item.code || '').toUpperCase(),
              track: (item.track || item.language || 'FR').toUpperCase() === 'EN' ? 'EN' : 'FR',
              average: item.average ?? item.value ?? 0,
            });
          }
        }
      } catch {
        // Silencieux — on continue avec d'autres périodes
      }
    }

    // ─── 5. Construire les séries pour le graphique ─────────────────────────
    const series: GradeSeries[] = [];
    const tracks: Array<'FR' | 'EN'> = bilingualEnabled ? ['FR', 'EN'] : ['FR'];

    // Si on n'a pas de données par période, on construit quand même les séries
    // avec les moyennes globales (une seule période "Année")
    const hasPeriodData = Object.values(periodAverages).some(arr => arr.length > 0);

    if (!hasPeriodData && weightedAvgByLevel.length > 0) {
      // Pas de données par période mais on a des moyennes globales
      for (const levelAvg of weightedAvgByLevel) {
        if (!LEVEL_ORDER.includes(levelAvg.levelCode)) continue;

        for (const track of tracks) {
          series.push({
            levelCode: levelAvg.levelCode,
            levelLabel: getLevelLabel(levelAvg.levelCode),
            track,
            scale: getScaleForLevelTrack(levelAvg.levelCode, track),
            data: [{ period: 'Année', value: levelAvg.average }],
          });
        }
      }
    } else {
      // Données par période disponibles
      for (const track of tracks) {
        for (const levelCode of LEVEL_ORDER) {
          const data: PeriodValue[] = periods.map(period => {
            const found = periodAverages[period.id]?.find(
              a => a.levelCode === levelCode && a.track === track
            );
            return {
              period: period.name,
              value: found?.average ?? 0,
            };
          });

          // Ne pas inclure la série si toutes les valeurs sont à 0
          if (data.some(d => d.value > 0)) {
            series.push({
              levelCode,
              levelLabel: getLevelLabel(levelCode),
              track,
              scale: getScaleForLevelTrack(levelCode, track),
              data,
            });
          }
        }
      }
    }

    const response: GradeEvolutionResponse = {
      periods: periods.map(p => p.name),
      series: series.sort((a, b) => {
        const aIdx = LEVEL_ORDER.indexOf(a.levelCode);
        const bIdx = LEVEL_ORDER.indexOf(b.levelCode);
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.track === 'FR' ? -1 : 1;
      }),
      bilingualEnabled,
      _source: series.length > 0 ? 'ok' : 'empty',
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/grade-evolution:', error);
    return NextResponse.json(
      {
        periods: [],
        series: [],
        bilingualEnabled: false,
        _source: 'error',
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
