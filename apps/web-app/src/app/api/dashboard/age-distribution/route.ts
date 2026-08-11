/**
 * ============================================================================
 * API ROUTE: /api/dashboard/age-distribution
 * ============================================================================
 *
 * Distribution des âges des élèves par tranche + par niveau scolaire.
 *
 * Retourne :
 * {
 *   global: [{ ageRange: '3-5', count: 120 }, { ageRange: '6-10', count: 200 }, ...],
 *   byLevel: [
 *     { levelCode: 'MATERNELLE', levelLabel: 'Maternelle', distribution: [...] },
 *     { levelCode: 'PRIMAIRE', levelLabel: 'Primaire', distribution: [...] },
 *     { levelCode: 'SECONDAIRE', levelLabel: 'Secondaire', distribution: [...] },
 *   ]
 * }
 *
 * Tranches d'âge : 0-2, 3-5, 6-8, 9-11, 12-14, 15-17, 18+
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];
const AGE_RANGES = [
  { min: 0, max: 2, label: '0-2 ans' },
  { min: 3, max: 5, label: '3-5 ans' },
  { min: 6, max: 8, label: '6-8 ans' },
  { min: 9, max: 11, label: '9-11 ans' },
  { min: 12, max: 14, label: '12-14 ans' },
  { min: 15, max: 17, label: '15-17 ans' },
  { min: 18, max: 999, label: '18+ ans' },
];

function getLevelLabel(code: string): string {
  const map: Record<string, string> = {
    MATERNELLE: 'Maternelle', PRIMAIRE: 'Primaire', SECONDAIRE: 'Secondaire',
    COLLEGE: 'Collège', LYCEE: 'Lycée',
  };
  return map[code] || code;
}

function computeAge(birthDate: string): number | null {
  if (!birthDate) return null;
  try {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  } catch { return null; }
}

function getAgeRangeIndex(age: number): number {
  for (let i = 0; i < AGE_RANGES.length; i++) {
    if (age >= AGE_RANGES[i].min && age <= AGE_RANGES[i].max) return i;
  }
  return AGE_RANGES.length - 1;
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

    // Récupérer tous les élèves avec leur date de naissance + niveau scolaire
    let students: any[] = [];
    try {
      const url = new URL(`${baseUrl}/students`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '1000');
      url.searchParams.append('select', 'id,firstName,lastName,dateOfBirth,schoolLevelId,schoolLevel.code');

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        12000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        students = Array.isArray(data) ? data : (data?.data || data?.items || data?.students || []);
      }
    } catch (e) {
      console.warn('[age-distribution] students fetch failed:', (e as Error).message);
    }

    // Calculer les âges et distribuer par tranche
    const globalDistribution = AGE_RANGES.map(r => ({ ageRange: r.label, count: 0 }));
    const levelMap = new Map<string, { levelCode: string; levelLabel: string; distribution: typeof globalDistribution }>();

    for (const student of students) {
      const age = computeAge(student.dateOfBirth || student.birthDate);
      if (age === null) continue;

      const rangeIdx = getAgeRangeIndex(age);
      globalDistribution[rangeIdx].count += 1;

      const levelCode = (student.schoolLevel?.code || student.schoolLevelCode || '').toUpperCase();
      if (!levelCode) continue;

      if (!levelMap.has(levelCode)) {
        levelMap.set(levelCode, {
          levelCode,
          levelLabel: getLevelLabel(levelCode),
          distribution: AGE_RANGES.map(r => ({ ageRange: r.label, count: 0 })),
        });
      }
      levelMap.get(levelCode)!.distribution[rangeIdx].count += 1;
    }

    const byLevel = LEVEL_ORDER
      .filter(code => levelMap.has(code))
      .map(code => levelMap.get(code)!);

    return NextResponse.json({
      global: globalDistribution,
      byLevel,
      totalStudents: students.length,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/age-distribution:', error);
    return NextResponse.json(
      { global: [], byLevel: [], totalStudents: 0, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
