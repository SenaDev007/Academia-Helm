/**
 * ============================================================================
 * API ROUTE: /api/dashboard/finance-overview
 * ============================================================================
 *
 * Vue d'ensemble financière — CORRIGÉE v3.
 *
 * ⭐ Source de vérité :
 *    - /finance/reports/kpi pour les totaux globaux (totalDue, previsonnementGlobal, totalReductions, totalPaid)
 *    - /finance/student-accounts pour les données par élève (totalDue, totalPaid, balance, schoolLevel, class)
 *    - /finance/fee-structures/overrides pour les personnalisations par niveau
 *    - /students/statistics pour les effectifs par classe
 *
 * Le montantTotalDu (prévisionnel standard) = previsonnementGlobal du KPI backend
 * Le montantPersonnalise = totalDue du KPI backend (après personnalisations)
 * totalReduction = totalReductions du KPI backend
 * montantPercu = totalPaid du KPI backend
 * montantRestant = montantPersonnalise - montantPercu
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

    // ─── 1. KPI global du backend (source de vérité pour les totaux) ───
    let kpi: any = {};
    try {
      const url = new URL(`${baseUrl}/finance/reports/kpi`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) kpi = await res.json().catch(() => ({}));
    } catch (e) { console.warn('[finance-overview] kpi failed:', (e as Error).message); }

    // ─── 2. Student-accounts (pour la répartition par niveau + classe) ─
    let studentAccounts: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/student-accounts`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '2000');
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 12000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        studentAccounts = Array.isArray(data) ? data : (data?.items || data?.data || data?.accounts || []);
      }
    } catch (e) { console.warn('[finance-overview] student-accounts failed:', (e as Error).message); }

    // ─── 3. Overrides (pour les personnalisations par niveau) ──────────
    let overrides: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/fee-structures/overrides`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '2000');
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        overrides = Array.isArray(data) ? data : (data?.items || data?.overrides || data?.data || []);
      }
    } catch (e) { console.warn('[finance-overview] overrides failed:', (e as Error).message); }

    // ─── 4. Students statistics (pour les effectifs par classe) ────────
    let studentsStats: any = null;
    try {
      const url = new URL(`${baseUrl}/students/statistics`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) studentsStats = await res.json().catch(() => null);
    } catch (e) { console.warn('[finance-overview] students stats failed:', (e as Error).message); }

    // ─── 5. Agréger par niveau scolaire ────────────────────────────────
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
      const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;
      const entry = getLevel(levelCode);
      if (!entry) continue;
      entry.montantPersonnalise += Number(sa.totalDue || 0);
      entry.montantPercu += Number(sa.totalPaid || 0);
      entry.montantRestant += Number(sa.balance || 0);
      entry.nombreEleves += 1;
    }

    // Agréger les overrides par niveau
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

    // ⭐ montantTotalDu (prévisionnel standard) = montantPersonnalise + totalReduction
    for (const entry of levelMap.values()) {
      entry.montantTotalDu = entry.montantPersonnalise + entry.totalReduction;
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // ─── 6. Agréger par classe ─────────────────────────────────────────
    //    Utiliser les student-accounts pour les montants par classe
    const classMap = new Map<string, any>();

    for (const sa of studentAccounts) {
      const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
      if (!levelCode || levelCode === 'ALL') continue;

      // Récupérer la classe de l'élève depuis les enrollments
      const enrollment = sa.student?.studentEnrollments?.find((e: any) =>
        e.academicYearId === academicYearId || !academicYearId
      );
      const classId = enrollment?.classId || enrollment?.class?.id;
      const className = enrollment?.class?.name || 'Sans classe';

      if (!classId) {
        // Élève sans classe → on le met dans "Sans classe"
        const key = `noclass_${levelCode}`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            classId: key,
            className: 'Sans classe',
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
      } else if (!classMap.has(classId)) {
        classMap.set(classId, {
          classId,
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

      const entry = classMap.get(classId || `noclass_${levelCode}`);
      if (entry) {
        entry.effectif += 1;
        entry.montantPersonnalise += Number(sa.totalDue || 0);
        entry.montantPercu += Number(sa.totalPaid || 0);
        entry.montantRestant += Number(sa.balance || 0);
      }
    }

    // Ajouter les personnalisations par classe
    for (const override of overrides) {
      const levelCode = (override.feeStructure?.level?.code || '').toUpperCase();
      const studentId = override.studentId;
      // Trouver la classe de cet élève
      const sa = studentAccounts.find((s: any) => s.studentId === studentId);
      const enrollment = sa?.student?.studentEnrollments?.find((e: any) =>
        e.academicYearId === academicYearId || !academicYearId
      );
      const classId = enrollment?.classId || `noclass_${levelCode}`;
      const entry = classMap.get(classId);
      if (entry) {
        entry.nombrePersonnalisations += 1;
        const original = Number(override.feeStructure?.totalAmount || 0);
        const custom = Number(override.customAmount || 0);
        entry.totalReduction += Math.max(0, original - custom);
      }
    }

    // Calculer montantTotalDu et taux par classe
    for (const entry of classMap.values()) {
      entry.montantTotalDu = entry.montantPersonnalise + entry.totalReduction;
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // Trier les classes et les ajouter aux niveaux
    const sortedClasses = sortClasses(Array.from(classMap.values()));
    for (const cls of sortedClasses) {
      const levelEntry = getLevel(cls.levelCode);
      if (levelEntry) {
        levelEntry.classes.push(cls);
      }
    }

    // ─── 7. Totaux globaux (depuis le KPI backend) ────────────────────
    const byLevel = sortByLevel(Array.from(levelMap.values()));

    // ⭐ Utiliser les totaux du KPI backend (source de vérité)
    const totals = {
      montantTotalDu: Number(kpi.previsonnementGlobal || kpi.totalDue || 0),
      montantPersonnalise: Number(kpi.totalDue || 0),
      totalReduction: Number(kpi.totalReductions || 0),
      montantPercu: Number(kpi.totalPaid || kpi.totalEncaissement || 0),
      montantRestant: Number(kpi.totalDue || 0) - Number(kpi.totalPaid || kpi.totalEncaissement || 0),
      nombreEleves: studentAccounts.length,
      nombrePersonnalisations: overrides.length,
      tauxRecouvrement: kpi.tauxRecouvrement || 0,
    };

    // ─── 8. Graphiques ─────────────────────────────────────────────────
    const evolutionMensuelle = generateMonthlyFallback();

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

function generateMonthlyFallback() {
  const months = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû'];
  return months.map(month => ({ month, amount: 0, count: 0 }));
}
