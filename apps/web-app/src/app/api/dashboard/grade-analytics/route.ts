/**
 * ============================================================================
 * API ROUTE: /api/dashboard/grade-analytics
 * ============================================================================
 *
 * Analytics des notes par niveau scolaire :
 *   - Plus forte moyenne générale (par niveau)
 *   - Plus faible moyenne générale (par niveau)
 *   - Top 3 élèves par classe (après chaque évaluation)
 *
 * Retourne :
 * {
 *   byLevel: [
 *     {
 *       levelCode: 'MATERNELLE', levelLabel: 'Maternelle',
 *       scale: 'qualitative',
 *       highestAverage: { studentName: '...', value: 'TS', class: '...' },
 *       lowestAverage: { studentName: '...', value: 'PS', class: '...' },
 *       topStudents: [
 *         { rank: 1, studentName: '...', average: 16.5, className: '6ème A' },
 *         { rank: 2, studentName: '...', average: 15.8, className: '6ème A' },
 *         { rank: 3, studentName: '...', average: 15.2, className: '5ème B' },
 *       ]
 *     },
 *     ...
 *   ],
 *   currentPeriod: 'T1 — Évaluation 2' | 'T1 — Bilan' | 'Année complète'
 * }
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];

function getLevelLabel(code: string): string {
  const map: Record<string, string> = {
    MATERNELLE: 'Maternelle', PRIMAIRE: 'Primaire', SECONDAIRE: 'Secondaire',
    COLLEGE: 'Collège', LYCEE: 'Lycée',
  };
  return map[code] || code;
}

function getScaleForLevel(levelCode: string): 'qualitative' | '/20' | '/100' {
  if (levelCode === 'MATERNELLE') return 'qualitative';
  return '/20';
}

// Convertir un code qualitatif en valeur numérique pour comparaison
function qualitativeToValue(code: string | null | undefined): number {
  if (!code) return 0;
  const upper = code.toUpperCase();
  if (upper === 'TS') return 4;
  if (upper === 'S') return 3;
  if (upper === 'PS') return 2;
  if (upper === 'NS') return 1;
  return 0;
}

function valueToQualitative(value: number): string {
  if (value >= 3.5) return 'TS';
  if (value >= 2.5) return 'S';
  if (value >= 1.5) return 'PS';
  if (value >= 0.5) return 'NS';
  return '—';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const academicYearId = searchParams.get('academicYearId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // Récupérer les moyennes des élèves par période
    let periodAverages: any[] = [];
    try {
      const url = new URL(`${baseUrl}/students/period-averages`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '1000');

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        12000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        periodAverages = Array.isArray(data) ? data : (data?.data || data?.items || []);
      }
    } catch (e) {
      console.warn('[grade-analytics] period-averages fetch failed:', (e as Error).message);
    }

    // Si pas de données period-averages, essayer /exams/averages
    if (periodAverages.length === 0) {
      try {
        const url = new URL(`${baseUrl}/exams/averages`);
        url.searchParams.append('tenantId', tenantId);
        if (academicYearId) url.searchParams.append('academicYearId', academicYearId);

        const res = await fetchWithTimeout(
          normalizeApiUrl(url.toString()),
          { headers, cache: 'no-store' },
          10000,
        );

        if (res.ok) {
          const data = await res.json().catch(() => null);
          const list = Array.isArray(data) ? data : (data?.byLevel || data?.items || []);
          // Transformer au format attendu
          periodAverages = list.map((item: any) => ({
            studentId: item.studentId,
            studentName: `${item.student?.firstName || ''} ${item.student?.lastName || ''}`.trim(),
            levelCode: (item.schoolLevel?.code || item.levelCode || '').toUpperCase(),
            className: item.class?.name || item.className || '',
            average: item.average || item.value || 0,
            qualitativeCode: item.qualitativeCode || item.appreciation || null,
            period: item.period || item.periodName || '—',
          }));
        }
      } catch (e) {
        console.warn('[grade-analytics] exams/averages fetch failed:', (e as Error).message);
      }
    }

    // Grouper par niveau scolaire
    const levelMap = new Map<string, any[]>();
    for (const avg of periodAverages) {
      const levelCode = (avg.levelCode || avg.schoolLevel?.code || '').toUpperCase();
      if (!levelCode) continue;
      if (!levelMap.has(levelCode)) levelMap.set(levelCode, []);
      levelMap.get(levelCode)!.push(avg);
    }

    // Pour chaque niveau : calculer highest/lowest + top 3
    const byLevel = LEVEL_ORDER
      .filter(code => levelMap.has(code))
      .map(levelCode => {
        const students = levelMap.get(levelCode)!;
        const scale = getScaleForLevel(levelCode);

        // Trier par moyenne décroissante
        const sorted = students.slice().sort((a, b) => {
          const valA = scale === 'qualitative'
            ? qualitativeToValue(a.qualitativeCode)
            : (a.average || 0);
          const valB = scale === 'qualitative'
            ? qualitativeToValue(b.qualitativeCode)
            : (b.average || 0);
          return valB - valA;
        });

        const highest = sorted[0];
        const lowest = sorted[sorted.length - 1];

        const formatValue = (student: any) => {
          if (!student) return null;
          return {
            studentName: student.studentName || '—',
            value: scale === 'qualitative'
              ? (student.qualitativeCode || '—')
              : `${(student.average || 0).toFixed(2)} / 20`,
            className: student.className || '—',
          };
        };

        // Top 3 par classe (ou global si pas de classe)
        const topStudents = sorted.slice(0, 3).map((s, i) => ({
          rank: i + 1,
          studentName: s.studentName || '—',
          average: scale === 'qualitative'
            ? (s.qualitativeCode || '—')
            : (s.average || 0).toFixed(2),
          className: s.className || '—',
          scale,
        }));

        return {
          levelCode,
          levelLabel: getLevelLabel(levelCode),
          scale,
          highestAverage: formatValue(highest),
          lowestAverage: formatValue(lowest),
          topStudents,
          studentCount: students.length,
        };
      });

    // Déterminer la période actuelle
    const periods = [...new Set(periodAverages.map(s => s.period).filter(Boolean))];
    const currentPeriod = periods.length > 0 ? periods[0] : '—';

    return NextResponse.json({
      byLevel,
      currentPeriod,
      totalStudents: periodAverages.length,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/grade-analytics:', error);
    return NextResponse.json(
      { byLevel: [], currentPeriod: '—', totalStudents: 0, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
