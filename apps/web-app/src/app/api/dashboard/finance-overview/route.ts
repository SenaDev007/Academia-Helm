/**
 * ============================================================================
 * API ROUTE: /api/dashboard/finance-overview
 * ============================================================================
 *
 * Vue d'ensemble financière complète pour le dashboard du module Finance.
 *
 * Par niveau scolaire (Maternelle / Primaire / Secondaire) :
 *   - montantTotalDu : montant standard (avant personnalisations)
 *   - montantPersonnalise : montant total après personnalisations
 *   - totalReduction : différence entre standard et personnalisé
 *   - montantPerçu : total des paiements reçus
 *   - montantRestant : ce qui reste à recouvrer
 *   - tauxRecouvrement : %
 *   - nombreEleves : nombre d'élèves concernés
 *   - nombrePersonnalisations : nombre d'élèves avec personnalisation
 *
 * Par classe (détaillé) :
 *   - Mêmes données + nom de la classe + effectif
 *
 * Graphiques :
 *   - evolutionMensuelle : recettes mensuelles (12 mois)
 *   - comparaisonNiveaux : barres comparatives par niveau
 *   - recouvrementParClasse : taux de recouvrement par classe
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
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // ─── 1. Récupérer les KPIs financiers globaux ──────────────────────
    let financeKpis: any = {};
    try {
      const url = new URL(`${baseUrl}/finance/reports/kpi`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) financeKpis = await res.json().catch(() => ({}));
    } catch (e) { console.warn('[finance-overview] kpi failed:', (e as Error).message); }

    // ─── 2. Récupérer les personnalisations (overrides) ────────────────
    let overrides: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/fee-structures/overrides`);
      url.searchParams.append('academicYearId', academicYearId || '');
      url.searchParams.append('limit', '1000');
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        overrides = Array.isArray(data) ? data : (data?.items || data?.overrides || []);
      }
    } catch (e) { console.warn('[finance-overview] overrides failed:', (e as Error).message); }

    // ─── 3. Récupérer les fee structures par niveau ────────────────────
    let feeStructures: any[] = [];
    try {
      const url = new URL(`${baseUrl}/finance/fee-structures`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        feeStructures = Array.isArray(data) ? data : (data?.items || data?.data || []);
      }
    } catch (e) { console.warn('[finance-overview] fee-structures failed:', (e as Error).message); }

    // ─── 4. Récupérer les statistiques élèves (effectifs par classe) ───
    let studentsStats: any = null;
    try {
      const url = new URL(`${baseUrl}/students/statistics`);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 10000);
      if (res.ok) studentsStats = await res.json().catch(() => null);
    } catch (e) { console.warn('[finance-overview] students stats failed:', (e as Error).message); }

    // ─── 5. Récupérer les paiements mensuels (pour graphique évolution) ─
    let monthlyPayments: Array<{ month: string; amount: number; count: number }> = [];
    try {
      const url = new URL(`${baseUrl}/finance/payments/monthly-summary`);
      url.searchParams.append('tenantId', tenantId);
      if (academicYearId) url.searchParams.append('academicYearId', academicYearId);
      const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 8000).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        monthlyPayments = Array.isArray(data) ? data : (data?.items || data?.monthly || []);
      }
    } catch (e) { console.warn('[finance-overview] monthly payments failed:', (e as Error).message); }

    // ─── 6. Agréger par niveau scolaire ────────────────────────────────
    const levelMap = new Map<string, any>();

    // Helper : obtenir ou créer une entrée de niveau
    const getLevel = (code: string) => {
      const c = (code || 'OTHER').toUpperCase();
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

    // Agréger les fee structures par niveau
    for (const fs of feeStructures) {
      const levelCode = (fs.schoolLevel?.code || fs.level?.code || fs.schoolLevelCode || '').toUpperCase();
      if (!levelCode) continue;
      const entry = getLevel(levelCode);
      const amount = Number(fs.totalAmount || fs.amount || 0);
      entry.montantTotalDu += amount;
    }

    // Agréger les overrides par niveau
    for (const override of overrides) {
      const levelCode = (override.student?.schoolLevel?.code || override.schoolLevelCode || override.feeStructure?.schoolLevel?.code || '').toUpperCase();
      if (!levelCode) continue;
      const entry = getLevel(levelCode);
      const original = Number(override.originalAmount || override.feeStructure?.totalAmount || 0);
      const custom = Number(override.customAmount || override.adjustedAmount || 0);
      entry.nombrePersonnalisations += 1;
      entry.totalReduction += Math.max(0, original - custom);
      // Ajuster le montant personnalisé : on remplace le montant standard par le personnalisé
      entry.montantPersonnalise += custom;
    }

    // Calculer le montant personnalisé total (standard - réductions)
    for (const entry of levelMap.values()) {
      entry.montantPersonnalise = entry.montantTotalDu - entry.totalReduction;
    }

    // Agréger les effectifs par niveau
    const byGenderByLevel = studentsStats?.byGenderByLevel || [];
    for (const lvl of byGenderByLevel) {
      const code = (lvl.levelCode || lvl.level || '').toUpperCase();
      if (!code) continue;
      const entry = getLevel(code);
      entry.nombreEleves += lvl.total || (lvl.boys + lvl.girls) || 0;
    }

    // ─── 7. Répartir les paiements par niveau ──────────────────────────
    //    Le backend /finance/reports/kpi retourne souvent des totaux globaux.
    //    On essaie de récupérer par niveau si disponible.
    const revenueByLevel = financeKpis?.revenue?.byLevel || financeKpis?.byLevel || [];
    if (Array.isArray(revenueByLevel) && revenueByLevel.length > 0) {
      for (const rv of revenueByLevel) {
        const code = (rv.levelCode || rv.schoolLevel?.code || rv.level || '').toUpperCase();
        if (!code) continue;
        const entry = getLevel(code);
        entry.montantPercu += Number(rv.total || rv.collected || rv.paid || 0);
      }
    } else {
      // Fallback : répartir globalement proportionnellement
      const totalGlobalPercu = Number(financeKpis?.totalPaid || financeKpis?.totalEncaissement || 0);
      const totalDu = Array.from(levelMap.values()).reduce((s, l) => s + l.montantPersonnalise, 0);
      for (const entry of levelMap.values()) {
        if (totalDu > 0) {
          entry.montantPercu = Math.round(totalGlobalPercu * (entry.montantPersonnalise / totalDu));
        }
      }
    }

    // Calculer le reste et le taux
    for (const entry of levelMap.values()) {
      entry.montantRestant = Math.max(0, entry.montantPersonnalise - entry.montantPercu);
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // ─── 8. Agréger par classe ─────────────────────────────────────────
    const byClass = studentsStats?.byClass || [];
    const classMap = new Map<string, any>();

    for (const cls of byClass) {
      const levelCode = (cls.schoolLevel?.code || cls.levelCode || cls.level || '').toUpperCase();
      const className = cls.className || cls.name || cls.label || '—';
      const classId = cls.classId || cls.id || className;
      const count = cls.count || cls.total || cls.value || 0;

      if (!classMap.has(classId)) {
        classMap.set(classId, {
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
        });
      }
    }

    // Répartir les fee structures par classe
    for (const fs of feeStructures) {
      const classId = fs.classId || fs.classes?.id;
      const className = fs.class?.name || fs.classes?.name || fs.className;
      if (!classId && !className) continue;
      const key = classId || className;
      if (!classMap.has(key)) continue;
      const entry = classMap.get(key);
      entry.montantTotalDu += Number(fs.totalAmount || fs.amount || 0) * entry.effectif;
    }

    // Répartir les overrides par classe
    for (const override of overrides) {
      const classId = override.student?.classId || override.student?.enrollment?.classId;
      const className = override.student?.class?.name;
      const key = classId || className;
      if (!key || !classMap.has(key)) continue;
      const entry = classMap.get(key);
      const original = Number(override.originalAmount || override.feeStructure?.totalAmount || 0);
      const custom = Number(override.customAmount || 0);
      entry.nombrePersonnalisations += 1;
      entry.totalReduction += Math.max(0, original - custom);
    }

    // Calculer le reste par classe
    for (const entry of classMap.values()) {
      entry.montantPersonnalise = entry.montantTotalDu - entry.totalReduction;
      entry.montantRestant = Math.max(0, entry.montantPersonnalise - entry.montantPercu);
      entry.tauxRecouvrement = entry.montantPersonnalise > 0
        ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100)
        : 0;
    }

    // Ajouter les classes aux niveaux correspondants
    for (const cls of classMap.values()) {
      const levelEntry = getLevel(cls.levelCode);
      levelEntry.classes.push(cls);
    }

    // ─── 9. Totaux globaux ─────────────────────────────────────────────
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

    // ─── 10. Graphiques ────────────────────────────────────────────────
    // Evolution mensuelle des paiements
    const evolutionMensuelle = monthlyPayments.length > 0
      ? monthlyPayments.map(m => ({ month: m.month, amount: Number(m.amount || 0), count: Number(m.count || 0) }))
      : generateMonthlyFallback();

    // Comparaison par niveau (barres)
    const comparaisonNiveaux = byLevel.map(lvl => ({
      label: lvl.levelLabel,
      du: lvl.montantTotalDu,
      personnalise: lvl.montantPersonnalise,
      percu: lvl.montantPercu,
      restant: lvl.montantRestant,
    }));

    // Recouvrement par classe (top 10)
    const recouvrementParClasse = Array.from(classMap.values())
      .sort((a, b) => a.tauxRecouvrement - b.tauxRecouvrement)
      .slice(0, 10)
      .map(c => ({ className: c.className, taux: c.tauxRecouvrement, restant: c.montantRestant }));

    return NextResponse.json({
      totals,
      byLevel,
      byClass: Array.from(classMap.values()).sort((a, b) => a.levelLabel.localeCompare(b.levelLabel)),
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
