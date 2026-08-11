/**
 * ============================================================================
 * API ROUTE: /api/dashboard/finance-overview
 * ============================================================================
 *
 * Vue d'ensemble financière — v5 CORRIGÉE.
 *
 * ⭐ CORRECTION v5 :
 *    - Appelle le backend NestJS directement (pas les routes BFF)
 *    - Transmet les headers d'auth + tenant via getProxyAuthHeaders
 *    - Le KPI backend est la source de vérité pour les totaux globaux
 *    - Les student-accounts sont agrégés par niveau + classe
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

function sortByLevel(levels: any[]): any[] {
  return [...levels].sort((a, b) => {
    const aIdx = LEVEL_ORDER.indexOf(a.levelCode);
    const bIdx = LEVEL_ORDER.indexOf(b.levelCode);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

const CLASS_ORDER = [
  'MATERNELLE 1', 'MATERNELLE 2', 'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CM',
  '6E', '6ÈME', '5E', '5ÈME', '4E', '4ÈME', '3E', '3ÈME',
  'SECONDE', '2NDE', 'PREMIERE', '1ÈRE', '1ERE', 'TERMINALE', 'TLE',
];

function sortClasses(classes: any[]): any[] {
  return [...classes].sort((a, b) => {
    const aName = (a.className || '').toUpperCase();
    const bName = (b.className || '').toUpperCase();
    const aIdx = CLASS_ORDER.findIndex(c => aName.includes(c));
    const bIdx = CLASS_ORDER.findIndex(c => bName.includes(c));
    if (aIdx === -1 && bIdx === -1) return aName.localeCompare(bName);
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
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();
    const qs = new URLSearchParams();
    qs.set('tenantId', tenantId);
    if (academicYearId) qs.set('academicYearId', academicYearId);
    const qsStr = qs.toString();

    // Helper : fetch backend NestJS directement
    async function fetchBackend(path: string): Promise<any> {
      try {
        const url = normalizeApiUrl(`${baseUrl}${path}${path.includes('?') ? '&' : '?'}${qsStr}`);
        const res = await fetchWithTimeout(url, { headers, cache: 'no-store' }, 12000);
        if (!res.ok) return null;
        return await res.json().catch(() => null);
      } catch (e) {
        console.warn(`[finance-overview] ${path} failed:`, (e as Error).message);
        return null;
      }
    }

    // ─── 1. KPI global (source de vérité pour les totaux) ─────────────
    const kpi = await fetchBackend('/finance/reports/kpi') || {};

    // ─── 2. Student-accounts ───────────────────────────────────────────
    const saData = await fetchBackend('/finance/student-accounts?limit=10000');
    const studentAccounts: any[] = Array.isArray(saData)
      ? saData
      : (saData?.items || saData?.data || saData?.accounts || []);

    // ─── 3. Overrides ──────────────────────────────────────────────────
    const ovrData = await fetchBackend('/finance/fee-structures/overrides?limit=10000');
    const overrides: any[] = Array.isArray(ovrData)
      ? ovrData
      : (ovrData?.items || ovrData?.overrides || ovrData?.data || []);

    // ─── 4. Students statistics ────────────────────────────────────────
    const studentsStats = await fetchBackend('/students/statistics') || {};

    // ─── 5. Agréger par niveau ─────────────────────────────────────────
    const levelMap = new Map<string, any>();
    const getLevel = (code: string) => {
      const c = (code || '').toUpperCase();
      if (!c || c === 'ALL') return null;
      if (!levelMap.has(c)) {
        levelMap.set(c, {
          levelCode: c,
          levelLabel: getLevelLabel(c),
          montantTotalDu: 0,
          montantPersonnalise: 0,
          totalReduction: 0,
          montantPercu: 0,
          montantRestant: 0,
          tauxRecouvrement: 0,
          nombreEleves: 0,
          nombrePersonnalisations: 0,
          classes: [],
        });
      }
      return levelMap.get(c);
    };

    for (const sa of studentAccounts) {
      const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const entry = getLevel(levelCode);
      if (!entry) continue;
      entry.montantPersonnalise += Number(sa.totalDue || 0);
      entry.montantPercu += Number(sa.totalPaid || 0);
      entry.montantRestant += Number(sa.balance || 0);
      entry.nombreEleves += 1;
    }

    for (const override of overrides) {
      const levelCode = (
        override.feeStructure?.level?.code ||
        override.feeStructure?.schoolLevel?.code ||
        override.student?.schoolLevel?.code ||
        ''
      ).toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const entry = getLevel(levelCode);
      if (!entry) continue;
      entry.nombrePersonnalisations += 1;
      const original = Number(override.feeStructure?.totalAmount || 0);
      const custom = Number(override.customAmount || 0);
      entry.totalReduction += Math.max(0, original - custom);
    }

    for (const entry of levelMap.values()) {
      entry.montantTotalDu = entry.montantPersonnalise + entry.totalReduction;
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // ─── 6. Agréger par classe ─────────────────────────────────────────
    const classMap = new Map<string, any>();

    for (const sa of studentAccounts) {
      const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;

      const enrollments = sa.student?.studentEnrollments || [];
      const enrollment = enrollments.find((e: any) =>
        academicYearId ? e.academicYearId === academicYearId : true
      ) || enrollments[0];

      const classId = enrollment?.classId || enrollment?.class?.id;
      const className = enrollment?.class?.name || 'Sans classe';
      const key = classId || `noclass_${levelCode}`;

      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: key,
          className,
          levelCode,
          levelLabel: getLevelLabel(levelCode),
          effectif: 0,
          montantTotalDu: 0,
          montantPersonnalise: 0,
          totalReduction: 0,
          montantPercu: 0,
          montantRestant: 0,
          tauxRecouvrement: 0,
          nombrePersonnalisations: 0,
        });
      }

      const entry = classMap.get(key);
      entry.effectif += 1;
      entry.montantPersonnalise += Number(sa.totalDue || 0);
      entry.montantPercu += Number(sa.totalPaid || 0);
      entry.montantRestant += Number(sa.balance || 0);
    }

    for (const override of overrides) {
      const studentId = override.studentId;
      const sa = studentAccounts.find((s: any) => s.studentId === studentId);
      if (!sa) continue;
      const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
      const enrollments = sa.student?.studentEnrollments || [];
      const enrollment = enrollments.find((e: any) =>
        academicYearId ? e.academicYearId === academicYearId : true
      ) || enrollments[0];
      const key = enrollment?.classId || `noclass_${levelCode}`;
      const entry = classMap.get(key);
      if (entry) {
        entry.nombrePersonnalisations += 1;
        const original = Number(override.feeStructure?.totalAmount || 0);
        const custom = Number(override.customAmount || 0);
        entry.totalReduction += Math.max(0, original - custom);
      }
    }

    for (const entry of classMap.values()) {
      entry.montantTotalDu = entry.montantPersonnalise + entry.totalReduction;
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    const sortedClasses = sortClasses(Array.from(classMap.values()));
    for (const cls of sortedClasses) {
      const levelEntry = getLevel(cls.levelCode);
      if (levelEntry) levelEntry.classes.push(cls);
    }

    // ─── 7. Totaux globaux ─────────────────────────────────────────────
    const byLevel = sortByLevel(Array.from(levelMap.values()));
    const totals = {
      montantTotalDu: Number(kpi.previsonnementGlobal || kpi.totalDue || 0),
      montantPersonnalise: Number(kpi.totalDue || 0),
      totalReduction: Number(kpi.totalReductions || 0),
      montantPercu: Number(kpi.totalPaid || kpi.totalEncaissement || 0),
      montantRestant: Math.max(0, Number(kpi.totalDue || 0) - Number(kpi.totalPaid || kpi.totalEncaissement || 0)),
      nombreEleves: studentAccounts.length,
      nombrePersonnalisations: overrides.length,
      tauxRecouvrement: kpi.tauxRecouvrement || 0,
    };

    // ─── 8. Graphiques ─────────────────────────────────────────────────
    const months = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû'];
    const evolutionMensuelle = months.map(month => ({ month, amount: 0, count: 0 }));

    const comparaisonNiveaux = byLevel.map(lvl => ({
      label: lvl.levelLabel,
      du: lvl.montantTotalDu,
      personnalise: lvl.montantPersonnalise,
      percu: lvl.montantPercu,
      restant: lvl.montantRestant,
    }));

    const recouvrementParClasse = sortedClasses
      .filter(c => c.className !== 'Sans classe')
      .sort((a, b) => a.tauxRecouvrement - b.tauxRecouvrement)
      .slice(0, 10)
      .map(c => ({ className: c.className, taux: c.tauxRecouvrement, restant: c.montantRestant }));

    return NextResponse.json({
      totals,
      byLevel,
      byClass: sortedClasses,
      evolutionMensuelle,
      comparaisonNiveaux,
      recouvrementParClasse,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/finance-overview:', error);
    return NextResponse.json(
      { totals: {}, byLevel: [], byClass: [], evolutionMensuelle: [], comparaisonNiveaux: [], recouvrementParClasse: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
