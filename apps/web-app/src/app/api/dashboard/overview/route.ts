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

    // ─── Appels backend parallélisés (Promise.all au lieu de 3 awaits séquentiels)
    //    Avant : 3 fetchs séquentiels × 8-12s timeout = 24-36s dans le pire cas
    //    Maintenant : 3 fetchs en parallèle = max(12s, 8s, 8s) = 12s dans le pire cas
    // ──────────────────────────────────────────────────────────────────────────

    // ⭐ Appel 1 : Statistiques élèves (effectifs par sexe/niveau)
    const statsUrl = new URL(`${baseUrl}/students/statistics`);
    statsUrl.searchParams.append('academicYearId', academicYearId);
    if (schoolLevelId) statsUrl.searchParams.append('schoolLevelId', schoolLevelId);
    statsUrl.searchParams.append('include', 'abandons');

    // ⭐ Appel 2 : Abandons (endpoint dédié)
    const abandonsUrl = new URL(`${baseUrl}/students/abandons`);
    abandonsUrl.searchParams.append('academicYearId', academicYearId);
    if (schoolLevelId) abandonsUrl.searchParams.append('schoolLevelId', schoolLevelId);

    // ⚠️ L'appel à /finance/student-balances a été SUPPRIMÉ car :
    //   1. Cet endpoint n'existe PAS côté backend (aucun match dans apps/api-server/src)
    //   2. Les données financières sont déjà incluses dans la réponse /students/abandons
    //      (champs totalDue, totalPaid, balance, hasPaidTuition, hasUnpaidTuition, unpaidAmount)
    //   3. L'appel fantôme causait un timeout silencieux de 8s à chaque requête dashboard

    const [statsRes, abandonsRes] = await Promise.allSettled([
      fetchWithTimeout(
        normalizeApiUrl(statsUrl.toString()),
        { headers, cache: 'no-store' },
        12000,
      ),
      fetchWithTimeout(
        normalizeApiUrl(abandonsUrl.toString()),
        { headers, cache: 'no-store' },
        8000,
      ).catch(() => null),
    ]);

    // ─── Parsing réponse 1 : studentsStats ────────────────────────────────
    let studentsStats: any = null;
    let studentsStatsStatus: 'ok' | 'fallback' | 'error' = 'fallback';
    if (statsRes.status === 'fulfilled' && statsRes.value?.ok) {
      studentsStats = await statsRes.value.json().catch(() => null);
      studentsStatsStatus = 'ok';
    }

    // ─── Parsing réponse 2 : abandonsData ────────────────────────────────
    let abandonsData: any[] = [];
    let abandonsStatus: 'ok' | 'fallback' | 'error' = 'fallback';
    if (abandonsRes.status === 'fulfilled') {
      const res = abandonsRes.value;
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
    }

    // ⚠️ balancesData supprimé — les données financières sont lues directement
    //    depuis abandonsData[i].totalPaid / totalDue / balance (fournies par le backend)
    const balancesStatus: 'ok' | 'fallback' | 'error' = 'skipped';

    // ─── Agrégation par niveau ─────────────────────────────────────────────
    // Map<levelCode, LevelOverview>
    const levelMap = new Map<string, LevelOverview>();

    // Index des abandons par studentId (pour lookup rapide)
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
    //    ⭐ FIX : le backend retourne schoolLevel comme OBJET imbriqué { id, code, name, label }
    //       Avant : on cherchait abandon.schoolLevelCode à plat → toujours undefined →
    //       if (!code) continue → tous les abandons skippés → abandons = 0 partout
    //       Maintenant : on extrait le code depuis abandon.schoolLevel.code (ou .name en fallback)
    for (const abandon of abandonsData) {
      const sl = abandon.schoolLevel || {};
      const code = (
        abandon.schoolLevelCode ||
        abandon.levelCode ||
        abandon.level ||
        sl.code ||
        sl.name ||
        sl.label ||
        ''
      ).toString().toUpperCase();
      if (!code) continue;
      const entry = getLevel(code);
      entry.abandons += 1;
      const isBoy = (abandon.gender || '').toLowerCase().startsWith('m') || (abandon.gender || '').toLowerCase().startsWith('g');
      const isGirl = (abandon.gender || '').toLowerCase().startsWith('f');
      if (isBoy) entry.abandonBoys += 1;
      else if (isGirl) entry.abandonGirls += 1;

      // ⭐ FIX : les données financières sont directement sur l'objet abandon
      //    (fournies par le backend /students/abandons : totalDue, totalPaid, balance,
      //    hasPaidTuition, hasUnpaidTuition, unpaidAmount)
      //    Avant : on cherchait dans balanceByStudent (Map vide car /finance/student-balances
      //    n'existait pas) → montants = 0
      //    Maintenant : on lit directement abandon.totalPaid / abandon.totalDue
      const paid = Number(abandon.totalPaid || 0);
      const due = Number(abandon.totalDue || 0);
      const unpaid = Number(abandon.unpaidAmount || Math.max(0, due - paid));

      if (paid > 0) {
        entry.abandonsWithPaidTuition += 1;
        entry.abandonPaidAmount += paid;
      }
      if (unpaid > 0) {
        entry.abandonsWithUnpaidTuition += 1;
        entry.abandonUnpaidAmount += unpaid;
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
