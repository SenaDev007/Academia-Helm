/**
 * ============================================================================
 * API ROUTE: /api/dashboard/overview
 * ============================================================================
 *
 * Vue d'ensemble des effectifs + abandons + scolarités par niveau scolaire.
 *
 * Retourne :
 * {
 *   totalStudents: number,        // y compris abandons
 *   activeStudents: number,       // élèves actifs (sans abandons)
 *   totalAbandons: number,        // abandons de l'année
 *   byLevel: [
 *     {
 *       level: 'Maternelle',
 *       levelCode: 'MATERNELLE',
 *       total: 120,    boys: 60,    girls: 60,
 *       abandons: 5,   abandonBoys: 2,   abandonGirls: 3,
 *       active: 115,
 *       // Scolarités des abandons
 *       abandonsWithPaidTuition: 2,    // abandons qui avaient payé avant
 *       abandonPaidAmount: 250000,     // montant total payé par les abandons (F CFA)
 *       abandonsWithUnpaidTuition: 3,   // abandons qui devaient encore payer
 *       abandonUnpaidAmount: 375000,   // montant total impayé par les abandons (F CFA)
 *     },
 *     ...
 *   ]
 * }
 *
 * Stratégie :
 * 1. Appelle /students/statistics (déjà existe) pour les effectifs par sexe/niveau
 * 2. Appelle /students/abandons (ou /students/statistics?include=abandons) pour les abandons
 * 3. Appelle /finance/student-balances ou /finance/reports pour les scolarités
 * 4. Agrège tout dans une structure simple à consommer par le frontend
 *
 * ⭐ Si le backend ne connaît pas certaines routes, on renvoie des zéros
 *    plutôt que de crasher. Le dashboard affichera des zones vides.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

// Ordre canonique des niveaux scolaires
const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];

interface LevelOverview {
  level: string;
  levelCode: string;
  total: number;
  boys: number;
  girls: number;
  abandons: number;
  abandonBoys: number;
  abandonGirls: number;
  active: number;
  abandonsWithPaidTuition: number;
  abandonPaidAmount: number;
  abandonsWithUnpaidTuition: number;
  abandonUnpaidAmount: number;
}

interface OverviewResponse {
  totalStudents: number;
  activeStudents: number;
  totalAbandons: number;
  byLevel: LevelOverview[];
  _sources: {
    studentsStats: 'ok' | 'fallback' | 'error';
    abandons: 'ok' | 'fallback' | 'error';
    balances: 'ok' | 'fallback' | 'error';
  };
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

function sortByLevel(levels: LevelOverview[]): LevelOverview[] {
  return [...levels].sort((a, b) => {
    const aIdx = LEVEL_ORDER.indexOf(a.levelCode);
    const bIdx = LEVEL_ORDER.indexOf(b.levelCode);
    if (aIdx === -1 && bIdx === -1) return a.level.localeCompare(b.level);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId is required' },
        { status: 400 },
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // ─── Appel 1 : Statistiques élèves (effectifs par sexe/niveau) ─────────
    let studentsStats: any = null;
    let studentsStatsStatus: 'ok' | 'fallback' | 'error' = 'fallback';
    try {
      const url = new URL(`${baseUrl}/students/statistics`);
      url.searchParams.append('academicYearId', academicYearId);
      if (schoolLevelId) url.searchParams.append('schoolLevelId', schoolLevelId);
      url.searchParams.append('include', 'abandons');

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        12000,
      );

      if (res.ok) {
        studentsStats = await res.json().catch(() => null);
        studentsStatsStatus = 'ok';
      }
    } catch (e) {
      console.warn('[dashboard/overview] students/statistics failed:', (e as Error).message);
    }

    // ─── Appel 2 : Abandons (endpoint dédié si disponible) ─────────────────
    let abandonsData: any[] = [];
    let abandonsStatus: 'ok' | 'fallback' | 'error' = 'fallback';
    try {
      const url = new URL(`${baseUrl}/students/abandons`);
      url.searchParams.append('academicYearId', academicYearId);
      if (schoolLevelId) url.searchParams.append('schoolLevelId', schoolLevelId);

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        8000,
      ).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data)) {
          abandonsData = data;
          abandonsStatus = 'ok';
        } else if (data && Array.isArray(data.items)) {
          abandonsData = data.items;
          abandonsStatus = 'ok';
        } else if (data && Array.isArray(data.students)) {
          abandonsData = data.students;
          abandonsStatus = 'ok';
        }
      }
    } catch (e) {
      console.warn('[dashboard/overview] students/abandons failed:', (e as Error).message);
    }

    // ─── Appel 3 : Soldes / scolarités par élève ───────────────────────────
    let balancesData: any[] = [];
    let balancesStatus: 'ok' | 'fallback' | 'error' = 'fallback';
    try {
      const url = new URL(`${baseUrl}/finance/student-balances`);
      url.searchParams.append('academicYearId', academicYearId);
      if (schoolLevelId) url.searchParams.append('schoolLevelId', schoolLevelId);

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        8000,
      ).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data)) {
          balancesData = data;
          balancesStatus = 'ok';
        } else if (data && Array.isArray(data.items)) {
          balancesData = data.items;
          balancesStatus = 'ok';
        } else if (data && Array.isArray(data.balances)) {
          balancesData = data.balances;
          balancesStatus = 'ok';
        }
      }
    } catch (e) {
      console.warn('[dashboard/overview] finance/student-balances failed:', (e as Error).message);
    }

    // ─── Agrégation par niveau ─────────────────────────────────────────────
    // Map<levelCode, LevelOverview>
    const levelMap = new Map<string, LevelOverview>();

    // Index des soldes par studentId pour lookup rapide
    const balanceByStudent = new Map<string, any>();
    for (const b of balancesData) {
      if (b && (b.studentId || b.id)) {
        balanceByStudent.set(b.studentId || b.id, b);
      }
    }
    // Index des abandons par studentId
    const abandonByStudent = new Map<string, any>();
    for (const a of abandonsData) {
      if (a && (a.studentId || a.id)) {
        abandonByStudent.set(a.studentId || a.id, a);
      }
    }

    // Helper : créer ou récupérer un LevelOverview
    const getLevel = (code: string): LevelOverview => {
      const c = (code || 'OTHER').toUpperCase();
      if (!levelMap.has(c)) {
        levelMap.set(c, {
          level: getLevelLabel(c),
          levelCode: c,
          total: 0, boys: 0, girls: 0,
          abandons: 0, abandonBoys: 0, abandonGirls: 0,
          active: 0,
          abandonsWithPaidTuition: 0, abandonPaidAmount: 0,
          abandonsWithUnpaidTuition: 0, abandonUnpaidAmount: 0,
        });
      }
      return levelMap.get(c)!;
    };

    // 1. Effectifs par niveau (depuis studentsStats.byGenderByLevel ou byLevel)
    const byGenderByLevel = studentsStats?.byGenderByLevel || [];
    for (const lvl of byGenderByLevel) {
      const code = (lvl.levelCode || lvl.level || lvl.code || '').toUpperCase();
      if (!code) continue;
      const entry = getLevel(code);
      entry.boys = lvl.boys || entry.boys || 0;
      entry.girls = lvl.girls || entry.girls || 0;
      entry.total = lvl.total || (entry.boys + entry.girls) || 0;
    }

    // Si byGenderByLevel est vide, essayer byLevel
    if (byGenderByLevel.length === 0) {
      const byLevel = studentsStats?.byLevel || studentsStats?.byClass || [];
      for (const lvl of byLevel) {
        const code = (lvl.levelCode || lvl.level || lvl.code || '').toUpperCase();
        if (!code) continue;
        const entry = getLevel(code);
        entry.total = (lvl.count || lvl.total || lvl.value || 0) + entry.total;
      }
    }

    // 2. Abandons par niveau
    for (const abandon of abandonsData) {
      const code = (abandon.schoolLevelCode || abandon.levelCode || abandon.level || '').toUpperCase();
      if (!code) continue;
      const entry = getLevel(code);
      entry.abandons += 1;
      const isBoy = (abandon.gender || '').toLowerCase().startsWith('m') || (abandon.gender || '').toLowerCase().startsWith('g');
      const isGirl = (abandon.gender || '').toLowerCase().startsWith('f');
      if (isBoy) entry.abandonBoys += 1;
      else if (isGirl) entry.abandonGirls += 1;

      // ⭐ Chercher le solde de scolarité de cet élève abandon
      const studentId = abandon.studentId || abandon.id;
      const balance = balanceByStudent.get(studentId);
      if (balance) {
        const paid = balance.totalPaid || balance.paidAmount || balance.amountPaid || 0;
        const due = balance.totalDue || balance.dueAmount || balance.amountDue || 0;
        const unpaid = Math.max(0, due - paid);
        if (paid > 0) {
          entry.abandonsWithPaidTuition += 1;
          entry.abandonPaidAmount += paid;
        }
        if (unpaid > 0) {
          entry.abandonsWithUnpaidTuition += 1;
          entry.abandonUnpaidAmount += unpaid;
        }
      }
    }

    // 3. Calcul des actifs
    for (const entry of levelMap.values()) {
      entry.active = Math.max(0, entry.total - entry.abandons);
    }

    // 4. Totaux globaux
    let totalStudents = 0;
    let totalAbandons = 0;
    for (const entry of levelMap.values()) {
      totalStudents += entry.total;
      totalAbandons += entry.abandons;
    }
    const activeStudents = Math.max(0, totalStudents - totalAbandons);

    const response: OverviewResponse = {
      totalStudents,
      activeStudents,
      totalAbandons,
      byLevel: sortByLevel(Array.from(levelMap.values())),
      _sources: {
        studentsStats: studentsStatsStatus,
        abandons: abandonsStatus,
        balances: balancesStatus,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/overview:', error);
    return NextResponse.json(
      {
        totalStudents: 0,
        activeStudents: 0,
        totalAbandons: 0,
        byLevel: [],
        _sources: { studentsStats: 'error', abandons: 'error', balances: 'error' },
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
