/**
 * ============================================================================
 * API ROUTE: /api/dashboard/hr-overview
 * ============================================================================
 *
 * Vue d'ensemble du personnel pour le dashboard promoteur.
 *
 * Retourne :
 * {
 *   totalStaff: number,           // total personnel (admin + enseignants)
 *   adminStaffCount: number,      // personnel administratif
 *   teachersCount: number,        // total enseignants
 *   teachersByLevel: [
 *     { levelCode: 'MATERNELLE', levelLabel: 'Maternelle', count: 5 },
 *     { levelCode: 'PRIMAIRE', levelLabel: 'Primaire', count: 12 },
 *     { levelCode: 'SECONDAIRE', levelLabel: 'Secondaire', count: 8 },
 *   ],
 *   _source: 'ok' | 'fallback' | 'error'
 * }
 *
 * Source backend :
 *   - /hr/overview/dashboard → snapshot avec totalStaff, totalTeachers, totalAdmin
 *   - /hr/staff → liste détaillée avec roleType + schoolLevel.code
 *     (utilisée pour la décomposition par niveau scolaire)
 *
 * ⭐ Si l'endpoint /hr/staff n'est pas disponible ou retourne une erreur,
 *    on retombe sur les chiffres globaux de /hr/overview/dashboard sans
 *    la décomposition par niveau.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];

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

function sortByLevel(levels: Array<{ levelCode: string }>): Array<any> {
  return [...levels].sort((a, b) => {
    const aIdx = LEVEL_ORDER.indexOf(a.levelCode);
    const bIdx = LEVEL_ORDER.indexOf(b.levelCode);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const academicYearId = searchParams.get('academicYearId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 },
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // ─── 1. Récupérer le snapshot global (totalStaff, totalTeachers, totalAdmin) ─
    let snapshot: { totalStaff?: number; totalTeachers?: number; totalAdmin?: number } = {};
    let snapshotStatus: 'ok' | 'fallback' | 'error' = 'fallback';

    try {
      const url = new URL(`${baseUrl}/hr/overview/dashboard`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        10000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        // Le snapshot peut être à la racine ou dans data.snapshot
        const snap = data?.snapshot || data;
        if (snap && typeof snap === 'object') {
          snapshot = {
            totalStaff: snap.totalStaff ?? snap.staffCount ?? null,
            totalTeachers: snap.totalTeachers ?? snap.teachersCount ?? null,
            totalAdmin: snap.totalAdmin ?? snap.adminStaffCount ?? null,
          };
          if (snapshot.totalStaff || snapshot.totalTeachers || snapshot.totalAdmin) {
            snapshotStatus = 'ok';
          }
        }
      }
    } catch (e) {
      console.warn('[dashboard/hr-overview] overview/dashboard failed:', (e as Error).message);
    }

    // ─── 2. Récupérer la liste détaillée du staff pour la décomposition par niveau ─
    let teachersByLevel: Array<{ levelCode: string; levelLabel: string; count: number }> = [];
    let adminStaffCount = 0;
    let teachersCount = 0;
    let staffStatus: 'ok' | 'fallback' | 'error' = 'fallback';

    try {
      const url = new URL(`${baseUrl}/hr/staff`);
      url.searchParams.append('tenantId', tenantId);
      url.searchParams.append('limit', '1000');

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        10000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        // Le staff peut être un array direct ou dans data.items / data.staff
        const staffList = Array.isArray(data)
          ? data
          : (data?.items || data?.staff || data?.data || []);

        // Agréger par rôle + niveau
        const levelMap = new Map<string, number>();

        for (const staff of staffList) {
          const roleType = (staff.roleType || staff.role || staff.category || '').toUpperCase();
          const isTeacher =
            roleType.includes('TEACHER') ||
            roleType.includes('ENSEIGN') ||
            roleType.includes('PROF') ||
            staff.isTeacher === true;

          if (isTeacher) {
            teachersCount += 1;
            // Récupérer le niveau scolaire du staff
            const levelCode = (
              staff.schoolLevel?.code ||
              staff.schoolLevelCode ||
              staff.level?.code ||
              staff.levelCode ||
              ''
            ).toUpperCase();

            if (levelCode) {
              levelMap.set(levelCode, (levelMap.get(levelCode) || 0) + 1);
            } else {
              // Enseignant sans niveau assigné — on le met dans "AUTRE"
              levelMap.set('AUTRE', (levelMap.get('AUTRE') || 0) + 1);
            }
          } else {
            // Personnel administratif
            adminStaffCount += 1;
          }
        }

        teachersByLevel = sortByLevel(
          Array.from(levelMap.entries()).map(([levelCode, count]) => ({
            levelCode,
            levelLabel: getLevelLabel(levelCode),
            count,
          }))
        );

        staffStatus = 'ok';
      }
    } catch (e) {
      console.warn('[dashboard/hr-overview] hr/staff failed:', (e as Error).message);
    }

    // ─── 3. Fallback : si /hr/staff a échoué, utiliser les totaux du snapshot ─
    if (staffStatus !== 'ok') {
      teachersCount = snapshot.totalTeachers || 0;
      adminStaffCount = snapshot.totalAdmin || 0;
    }

    const totalStaff = snapshot.totalStaff || (teachersCount + adminStaffCount);

    return NextResponse.json({
      totalStaff,
      adminStaffCount,
      teachersCount,
      teachersByLevel,
      _source: staffStatus === 'ok' || snapshotStatus === 'ok' ? 'ok' : 'fallback',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/hr-overview:', error);
    return NextResponse.json(
      {
        totalStaff: 0,
        adminStaffCount: 0,
        teachersCount: 0,
        teachersByLevel: [],
        _source: 'error',
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
