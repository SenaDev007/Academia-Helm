/**
 * ============================================================================
 * API ROUTE: /api/dashboard/finance-overview
 * ============================================================================
 *
 * Vue d'ensemble financière complète — CORRIGÉE.
 *
 * ⭐ Source de vérité : account_breakdowns + student_accounts
 *    (pas fee_structures individuelles — qui sont par élève, pas par classe)
 *
 * Par niveau scolaire :
 *   - montantTotalDu : SUM(fee_structures.totalAmount) pour tous les breakdowns
 *   - montantPersonnalise : SUM(account_breakdowns.initialAmount) (après overrides)
 *   - totalReduction : SUM(GREATEST(0, totalAmount - initialAmount))
 *   - montantPercu : SUM(student_accounts.totalPaid)
 *   - montantRestant : SUM(student_accounts.balance)
 *   - nombrePersonnalisations : COUNT WHERE initialAmount < totalAmount
 *
 * Par classe : mêmes données groupées par classe.
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

// Ordre canonique des classes (Maternelle → Primaire → Secondaire)
const CLASS_ORDER = [
  'MATERNELLE', 'MATERNELLE 1', 'MATERNELLE 2', 'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
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

    // ⭐ Utiliser /finance/reports/kpi pour les totaux globaux (déjà calculés côté backend)
    let financeKpis: any = {};
    try {
      const url = new URL(`${baseUrl}/finance/reports/kpi`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) financeKpis = await res.json().catch(() => ({}));
    } catch (e) { console.warn('[finance-overview] kpi failed:', (e as Error).message); }

    // ⭐ Récupérer les student-accounts avec les infos niveau + classe
    let studentAccounts: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/student-accounts`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '1000');
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 12000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        studentAccounts = Array.isArray(data) ? data : (data?.items || data?.data || data?.accounts || []);
      }
    } catch (e) { console.warn('[finance-overview] student-accounts failed:', (e as Error).message); }

    // ⭐ Récupérer les overrides (pour compter les personnalisations)
    let overrides: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/fee-structures/overrides`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '1000');
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        overrides = Array.isArray(data) ? data : (data?.items || data?.overrides || data?.data || []);
      }
    } catch (e) { console.warn('[finance-overview] overrides failed:', (e as Error).message); }

    // ⭐ Récupérer les statistiques élèves (effectifs par classe + par niveau)
    let studentsStats: any = null;
    try {
      const url = new URL(`${baseUrl}/students/statistics`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) studentsStats = await res.json().catch(() => null);
    } catch (e) { console.warn('[finance-overview] students stats failed:', (e as Error).message); }

    // ─── Agréger par niveau scolaire ─────────────────────────────────
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

    // Agréger les student-accounts par niveau
    for (const sa of studentAccounts) {
      const levelCode = (sa.student?.schoolLevel?.code || sa.student?.schoolLevelCode || sa.schoolLevelCode || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const entry = getLevel(levelCode);
      if (!entry) continue;
      entry.montantPercu += Number(sa.totalPaid || 0);
      entry.montantRestant += Number(sa.balance || 0);
      // totalDue du student_account = montant après personnalisations (initialAmount)
      entry.montantPersonnalise += Number(sa.totalDue || 0);
      entry.nombreEleves += 1;
    }

    // Agréger les overrides par niveau
    for (const override of overrides) {
      // ⭐ CORRECTION : la relation Prisma est "level" pas "schoolLevel" sur FeeStructure
      const levelCode = (
        override.feeStructure?.level?.code ||
        override.feeStructure?.schoolLevel?.code ||
        override.student?.schoolLevel?.code ||
        override.schoolLevelCode ||
        ''
      ).toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const entry = getLevel(levelCode);
      if (!entry) continue;
      entry.nombrePersonnalisations += 1;
      const original = Number(override.feeStructure?.totalAmount || override.originalAmount || 0);
      const custom = Number(override.customAmount || override.adjustedAmount || 0);
      entry.totalReduction += Math.max(0, original - custom);
      // Le montant "du standard" = somme des totalAmount des fee structures concernées
      entry.montantTotalDu += original;
    }

    // ⭐ CORRECTION : montantTotalDu = montantPersonnalise + totalReduction
    //    (car student_accounts.totalDue = après personnalisations)
    for (const entry of levelMap.values()) {
      entry.montantTotalDu = entry.montantPersonnalise + entry.totalReduction;
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // ─── Agréger par classe ──────────────────────────────────────────
    const byClass = studentsStats?.byClass || [];
    const classMap = new Map<string, any>();

    for (const cls of byClass) {
      const levelCode = (cls.schoolLevel?.code || cls.levelCode || cls.level || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const className = cls.className || cls.name || cls.label || '—';
      const classId = cls.classId || cls.id || className;
      const count = cls.count || cls.total || cls.value || 0;

      // Trouver les student-accounts correspondants à cette classe
      const classAccounts = studentAccounts.filter((sa: any) =>
        sa.student?.studentEnrollments?.some((en: any) => en.classId === classId || en.class?.id === classId) ||
        sa.student?.classId === classId
      );

      const classEntry = {
        classId,
        className,
        levelCode,
        levelLabel: getLevelLabel(levelCode),
        effectif: count,
        montantTotalDu: 0,
        montantPersonnalise: 0,
        totalReduction: 0,
        montantPercu: 0,
        montantRestant: 0,
        tauxRecouvrement: 0,
        nombrePersonnalisations: 0,
      };

      for (const sa of classAccounts) {
        classEntry.montantPercu += Number(sa.totalPaid || 0);
        classEntry.montantRestant += Number(sa.balance || 0);
        classEntry.montantPersonnalise += Number(sa.totalDue || 0);
      }

      // Compter les personnalisations pour cette classe
      const classOverrides = overrides.filter((o: any) => {
        const overrideClassId = o.student?.studentEnrollments?.[0]?.classId || o.student?.classId;
        return overrideClassId === classId;
      });
      classEntry.nombrePersonnalisations = classOverrides.length;
      classEntry.totalReduction = classOverrides.reduce((sum: number, o: any) => {
        const orig = Number(o.feeStructure?.totalAmount || 0);
        const custom = Number(o.customAmount || 0);
        return sum + Math.max(0, orig - custom);
      }, 0);
      classEntry.montantTotalDu = classEntry.montantPersonnalise + classEntry.totalReduction;
      classEntry.tauxRecouvrement = classEntry.montantPersonnalise > 0
        ? Math.round((classEntry.montantPercu / classEntry.montantPersonnalise) * 100)
        : 0;

      classMap.set(classId, classEntry);

      // Ajouter au niveau correspondant
      const levelEntry = getLevel(levelCode);
      if (levelEntry) {
        levelEntry.classes.push(classEntry);
      }
    }

    // Trier les classes par ordre canonique
    for (const entry of levelMap.values()) {
      entry.classes = sortClasses(entry.classes);
    }

    // ─── Totaux globaux ──────────────────────────────────────────────
    const byLevel = sortByLevel(Array.from(levelMap.values()));
    const totals = byLevel.reduce((acc, lvl) => ({
      montantTotalDu: acc.montantTotalDu + lvl.montantTotalDu,
      montantPersonnalise: acc.montantPersonnalise + lvl.montantPersonnalise,
      totalReduction: acc.totalReduction + lvl.totalReduction,
      montantPercu: acc.montantPercu + lvl.montantPercu,
      montantRestant: acc.montantRestant + lvl.montantRestant,
      nombreEleves: acc.nombreEleves + lvl.nombreEleves,
      nombrePersonnalisations: acc.nombrePersonnalisations + lvl.nombrePersonnalisations,
    }), {
      montantTotalDu: 0, montantPersonnalise: 0, totalReduction: 0,
      montantPercu: 0, montantRestant: 0, nombreEleves: 0, nombrePersonnalisations: 0,
    });
    totals.tauxRecouvrement = totals.montantPersonnalise > 0
      ? Math.round((totals.montantPercu / totals.montantPersonnalise) * 100) : 0;

    // ─── Graphiques ──────────────────────────────────────────────────
    const evolutionMensuelle = generateMonthlyFallback();

    const comparaisonNiveaux = byLevel.map(lvl => ({
      label: lvl.levelLabel,
      du: lvl.montantTotalDu,
      personnalise: lvl.montantPersonnalise,
      percu: lvl.montantPercu,
      restant: lvl.montantRestant,
    }));

    const recouvrementParClasse = sortClasses(Array.from(classMap.values()))
      .sort((a, b) => a.tauxRecouvrement - b.tauxRecouvrement)
      .slice(0, 10)
      .map(c => ({ className: c.className, taux: c.tauxRecouvrement, restant: c.montantRestant }));

    return NextResponse.json({
      totals,
      byLevel,
      byClass: sortClasses(Array.from(classMap.values())),
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

function generateMonthlyFallback() {
  const months = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû'];
  return months.map(month => ({ month, amount: 0, count: 0 }));
}
