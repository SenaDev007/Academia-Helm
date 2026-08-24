'use client';

/**
 * ============================================================================
 * FINANCE DASHBOARD V2 — Agrégation côté client (pas de route API serveur)
 * ============================================================================
 *
 * ⭐ CORRECTION v6 : l'agrégation se fait côté client (navigateur) au lieu
 *    d'une route API serveur. Le navigateur a les cookies de session et
 *    peut appeler les routes BFF directement.
 *
 * Le frontend appelle :
 *   - /api/finance/reports/kpi → totaux globaux (source de vérité)
 *   - /api/finance/student-accounts?exportAll=true → par élève
 *   - /api/finance/fee-structures/overrides?limit=10000 → personnalisations
 *   - /api/students/statistics → effectifs par classe
 *
 * Puis agrège en JavaScript pour construire byLevel + byClass.
 * ============================================================================
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, AlertCircle, ChevronDown, ChevronRight,
  DollarSign, Users, Download, Loader2, School,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useAppSession } from '@/contexts/AppSessionContext';
import { financeService } from '@/services/finance.service';

interface LevelData {
  levelCode: string;
  levelLabel: string;
  montantTotalDu: number;
  montantPersonnalise: number;
  totalReduction: number;
  montantPercu: number;
  montantRestant: number;
  tauxRecouvrement: number;
  nombreEleves: number;
  nombrePersonnalisations: number;
  classes: ClassData[];
}

interface ClassData {
  classId: string;
  className: string;
  levelCode: string;
  levelLabel: string;
  effectif: number;
  montantTotalDu: number;
  montantPersonnalise: number;
  totalReduction: number;
  montantPercu: number;
  montantRestant: number;
  tauxRecouvrement: number;
  nombrePersonnalisations: number;
}

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];
const LEVEL_COLORS: Record<string, string> = {
  MATERNELLE: '#ec4899', PRIMAIRE: '#3b82f6', SECONDAIRE: '#8b5cf6',
  COLLEGE: '#10b981', LYCEE: '#f59e0b',
};

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

function formatCurrency(amount: number): string {
  if (!amount || amount === 0) return '0 F CFA';
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' F CFA';
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function FinanceDashboardV2() {
  const { currentYear } = useAcademicYear();
  const { tenant } = useAppSession();
  const academicYearId = currentYear?.id;
  const tenantId = tenant?.id;
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // ⭐ Agrégation côté client (le navigateur a les cookies de session)
  useEffect(() => {
    if (!tenantId || !academicYearId) return;
    setLoading(true);

    async function load() {
      try {
        // 1. KPI global
        const kpiData = await financeService.getKpiReports({ tenantId, academicYearId }).catch(() => ({}));
        const kpi = kpiData || {};

        // 2. Student-accounts (exportAll=true pour récupérer TOUS les comptes)
        const saData = await financeService.getStudentAccounts({ academicYearId, exportAll: 'true' }).catch(() => []);
        const studentAccounts: any[] = Array.isArray(saData) ? saData : (saData?.items || saData?.data || []);

        // 3. Overrides
        const ovrData = await financeService.getAllFeeOverrides({ academicYearId }).catch(() => []);
        const overrides: any[] = Array.isArray(ovrData) ? ovrData : (ovrData?.items || ovrData?.data || []);

        // 4. Students statistics
        const statsRes = await fetch('/api/students/statistics?academicYearId=' + academicYearId, { credentials: 'include' }).catch(() => null);
        const studentsStats = statsRes ? await statsRes.json().catch(() => null) : null;

        // ─── Agréger par niveau ─────────────────────────────────────
        const levelMap = new Map<string, any>();
        const getLevel = (code: string) => {
          const c = (code || '').toUpperCase();
          if (!c || c === 'ALL') return null;
          if (!levelMap.has(c)) {
            levelMap.set(c, {
              levelCode: c, levelLabel: getLevelLabel(c),
              montantTotalDu: 0, montantPersonnalise: 0, totalReduction: 0,
              montantPercu: 0, montantRestant: 0, tauxRecouvrement: 0,
              nombreEleves: 0, nombrePersonnalisations: 0, classes: [],
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
            override.student?.schoolLevel?.code || ''
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
            ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100) : 0;
        }

        // ─── Agréger par classe ─────────────────────────────────────
        const classMap = new Map<string, any>();
        for (const sa of studentAccounts) {
          const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
          if (!levelCode || levelCode === 'ALL') continue;
          const enrollments = sa.student?.studentEnrollments || [];
          const enrollment = enrollments.find((e: any) => e.academicYearId === academicYearId) || enrollments[0];
          const classId = enrollment?.classId || enrollment?.class?.id;
          const className = enrollment?.class?.name || 'Sans classe';
          const key = classId || `noclass_${levelCode}`;
          if (!classMap.has(key)) {
            classMap.set(key, {
              classId: key, className, levelCode, levelLabel: getLevelLabel(levelCode),
              effectif: 0, montantTotalDu: 0, montantPersonnalise: 0, totalReduction: 0,
              montantPercu: 0, montantRestant: 0, tauxRecouvrement: 0, nombrePersonnalisations: 0,
            });
          }
          const entry = classMap.get(key);
          entry.effectif += 1;
          entry.montantPersonnalise += Number(sa.totalDue || 0);
          entry.montantPercu += Number(sa.totalPaid || 0);
          entry.montantRestant += Number(sa.balance || 0);
        }

        for (const override of overrides) {
          const sa = studentAccounts.find((s: any) => s.studentId === override.studentId);
          if (!sa) continue;
          const levelCode = (sa.student?.schoolLevel?.code || '').toUpperCase();
          const enrollments = sa.student?.studentEnrollments || [];
          const enrollment = enrollments.find((e: any) => e.academicYearId === academicYearId) || enrollments[0];
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
            ? Math.round((entry.montantPercu / entry.montantPersonnalise) * 100) : 0;
        }

        const sortedClasses = sortClasses(Array.from(classMap.values()));
        for (const cls of sortedClasses) {
          const levelEntry = getLevel(cls.levelCode);
          if (levelEntry) levelEntry.classes.push(cls);
        }

        const byLevel = sortByLevel(Array.from(levelMap.values()));
        const totals = {
          montantTotalDu: Number(kpi.previsonnementGlobal || kpi.totalDue || 0),
          montantPersonnalise: Number(kpi.totalDue || 0),
          totalReduction: Number(kpi.totalReductions || 0),
          montantPercu: Number(kpi.totalPaid || kpi.totalEncaissement || 0),
          montantRestant: Math.max(0, Number(kpi.totalDue || 0) - Number(kpi.totalPaid || 0)),
          nombreEleves: studentAccounts.length,
          nombrePersonnalisations: overrides.length,
          tauxRecouvrement: kpi.tauxRecouvrement || 0,
        };

        const months = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû'];
        const evolutionMensuelle = months.map(month => ({ month, amount: 0, count: 0 }));
        const comparaisonNiveaux = byLevel.map(lvl => ({
          label: lvl.levelLabel, du: lvl.montantTotalDu, personnalise: lvl.montantPersonnalise,
          percu: lvl.montantPercu, restant: lvl.montantRestant,
        }));
        const recouvrementParClasse = sortedClasses
          .filter(c => c.className !== 'Sans classe')
          .sort((a, b) => a.tauxRecouvrement - b.tauxRecouvrement)
          .slice(0, 10)
          .map(c => ({ className: c.className, taux: c.tauxRecouvrement, restant: c.montantRestant }));

        setData({ totals, byLevel, byClass: sortedClasses, evolutionMensuelle, comparaisonNiveaux, recouvrementParClasse });
      } catch (e) {
        console.error('[FinanceDashboard] Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, academicYearId]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-slate-600">Chargement du tableau de bord financier…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-700">Aucune donnée financière disponible.</p>
      </div>
    );
  }

  const totals = data.totals;

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl px-5 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Tableau de bord financier
        </h2>
        <p className="text-xs text-blue-100 mt-1">
          {currentYear?.name || 'Année en cours'} · Vue d'ensemble par niveau scolaire et par classe
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Montant dû (standard)" value={formatCurrency(totals.montantTotalDu)} subtitle={`${formatNumber(totals.nombreEleves)} élèves`} icon={DollarSign} color="indigo" />
        <KpiCard label="Après personnalisations" value={formatCurrency(totals.montantPersonnalise)} subtitle={`${formatNumber(totals.nombrePersonnalisations)} personnalisations · -${formatCurrency(totals.totalReduction)}`} icon={TrendingDown} color="purple" />
        <KpiCard label="Montant perçu" value={formatCurrency(totals.montantPercu)} subtitle={`Taux de recouvrement : ${totals.tauxRecouvrement}%`} icon={TrendingUp} color="emerald" />
        <KpiCard label="Reste à recouvrer" value={formatCurrency(totals.montantRestant)} subtitle={`${100 - totals.tauxRecouvrement}% du montant dû`} icon={AlertCircle} color="red" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EvolutionChart data={data.evolutionMensuelle} />
        <ComparisonChart data={data.comparaisonNiveaux} />
        <RecoveryChart data={data.recouvrementParClasse} />
        <DistributionDonut totals={totals} />
      </div>

      {/* Tableau par niveau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-600 px-5 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><School className="w-4 h-4" />Récapitulatif par niveau scolaire</h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Niveau</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-700">Élèves</th>
                <th className="text-right px-4 py-2 font-semibold text-indigo-700">Dû (standard)</th>
                <th className="text-right px-4 py-2 font-semibold text-purple-700">Personnalisé</th>
                <th className="text-right px-4 py-2 font-semibold text-red-700">Réduction</th>
                <th className="text-right px-4 py-2 font-semibold text-emerald-700">Perçu</th>
                <th className="text-right px-4 py-2 font-semibold text-orange-700">Restant</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-700">Taux</th>
                <th className="text-center px-4 py-2 font-semibold text-slate-700">Classes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byLevel.map((lvl: LevelData) => {
                const isExpanded = expandedLevel === lvl.levelCode;
                return (
                  <>
                    <tr key={lvl.levelCode} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedLevel(isExpanded ? null : lvl.levelCode)}>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[lvl.levelCode] || '#64748b' }} />
                          {lvl.levelLabel}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatNumber(lvl.nombreEleves)}</td>
                      <td className="px-4 py-3 text-right text-indigo-600 font-medium">{formatCurrency(lvl.montantTotalDu)}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-medium">{formatCurrency(lvl.montantPersonnalise)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(lvl.totalReduction)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{formatCurrency(lvl.montantPercu)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-bold">{formatCurrency(lvl.montantRestant)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lvl.tauxRecouvrement >= 80 ? 'bg-emerald-100 text-emerald-700' : lvl.tauxRecouvrement >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{lvl.tauxRecouvrement}%</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{lvl.classes.length}</td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && lvl.classes.map((cls: ClassData) => (
                        <motion.tr key={cls.classId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-50/50">
                          <td className="px-4 py-2 pl-12 text-slate-600">↳ {cls.className}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{cls.effectif}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(cls.montantTotalDu)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(cls.montantPersonnalise)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(cls.totalReduction)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(cls.montantPercu)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(cls.montantRestant)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">{cls.tauxRecouvrement}%</td>
                          <td className="px-4 py-2 text-center">{cls.nombrePersonnalisations > 0 && <span className="text-[10px] text-purple-600">{cls.nombrePersonnalisations} perso.</span>}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr className="font-bold">
                <td className="px-4 py-3 text-slate-900">TOTAL</td>
                <td className="px-4 py-3 text-right text-slate-900">{formatNumber(totals.nombreEleves)}</td>
                <td className="px-4 py-3 text-right text-indigo-700">{formatCurrency(totals.montantTotalDu)}</td>
                <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(totals.montantPersonnalise)}</td>
                <td className="px-4 py-3 text-right text-red-700">{formatCurrency(totals.totalReduction)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totals.montantPercu)}</td>
                <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(totals.montantRestant)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{totals.tauxRecouvrement}%</td>
                <td className="px-4 py-3 text-center text-slate-500">{data.byClass.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Version mobile */}
        <div className="md:hidden divide-y divide-slate-100">
          {data.byLevel.map((lvl: LevelData) => (
            <div key={lvl.levelCode} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[lvl.levelCode] || '#64748b' }} />
                  {lvl.levelLabel}
                </h4>
                <span className="text-xs text-slate-500">{lvl.nombreEleves} élèves</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-indigo-50 rounded p-2"><p className="text-indigo-500">Dû standard</p><p className="font-bold text-indigo-700">{formatCurrency(lvl.montantTotalDu)}</p></div>
                <div className="bg-purple-50 rounded p-2"><p className="text-purple-500">Personnalisé</p><p className="font-bold text-purple-700">{formatCurrency(lvl.montantPersonnalise)}</p></div>
                <div className="bg-emerald-50 rounded p-2"><p className="text-emerald-500">Perçu</p><p className="font-bold text-emerald-700">{formatCurrency(lvl.montantPercu)}</p></div>
                <div className="bg-orange-50 rounded p-2"><p className="text-orange-500">Restant</p><p className="font-bold text-orange-700">{formatCurrency(lvl.montantRestant)}</p></div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lvl.tauxRecouvrement >= 80 ? 'bg-emerald-100 text-emerald-700' : lvl.tauxRecouvrement >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>Recouvrement : {lvl.tauxRecouvrement}%</span>
                {lvl.classes.length > 0 && <button onClick={() => setExpandedLevel(expandedLevel === lvl.levelCode ? null : lvl.levelCode)} className="text-[10px] text-blue-600 font-bold">{expandedLevel === lvl.levelCode ? 'Masquer' : 'Détail'} ({lvl.classes.length})</button>}
              </div>
              {expandedLevel === lvl.levelCode && (
                <div className="mt-2 space-y-1">
                  {lvl.classes.map((cls: ClassData) => (
                    <div key={cls.classId} className="bg-slate-50 rounded p-2 text-xs">
                      <div className="flex justify-between"><span className="font-medium text-slate-700">{cls.className}</span><span className="text-slate-500">{cls.effectif} él.</span></div>
                      <div className="flex justify-between mt-1"><span className="text-emerald-600">Perçu: {formatCurrency(cls.montantPercu)}</span><span className="text-orange-600">Restant: {formatCurrency(cls.montantRestant)}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtitle, icon: Icon, color }: any) {
  const colors: Record<string, string> = { indigo: 'text-indigo-600 bg-indigo-50', purple: 'text-purple-600 bg-purple-50', emerald: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3"><div className={`p-2 rounded-lg ${colors[color] || colors.indigo}`}><Icon className="w-5 h-5" /></div></div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function EvolutionChart({ data }: { data: Array<{ month: string; amount: number; count: number }> }) {
  const maxValue = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Évolution mensuelle des recettes</h3>
      <div className="flex items-end justify-between gap-1 h-40">
        {data.map((item, i) => {
          const heightPercent = (item.amount / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-[8px] font-bold text-slate-500 tabular-nums">{item.amount > 0 ? (item.amount / 1000).toFixed(0) + 'k' : ''}</span>
              <div className="w-full flex items-end" style={{ height: '80px' }}>
                <div className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500 group-hover:opacity-80" style={{ height: `${Math.max(heightPercent, 1)}%` }} />
              </div>
              <span className="text-[8px] text-slate-400">{item.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonChart({ data }: { data: Array<{ label: string; du: number; personnalise: number; percu: number; restant: number }> }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.du, d.personnalise, d.percu)), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><School className="w-4 h-4 text-blue-600" />Comparaison par niveau</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="text-slate-500">{(item.percu / 1000).toFixed(0)}k / {(item.personnalise / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex gap-1 h-5">
              <div className="flex-1 bg-slate-100 rounded-l overflow-hidden relative"><div className="h-full bg-indigo-400 rounded-l" style={{ width: `${(item.du / maxValue) * 100}%` }} /></div>
              <div className="flex-1 bg-slate-100 relative"><div className="h-full bg-purple-400" style={{ width: `${(item.personnalise / maxValue) * 100}%` }} /></div>
              <div className="flex-1 bg-slate-100 relative"><div className="h-full bg-emerald-400" style={{ width: `${(item.percu / maxValue) * 100}%` }} /></div>
              <div className="flex-1 bg-slate-100 rounded-r overflow-hidden relative"><div className="h-full bg-orange-400 rounded-r" style={{ width: `${(item.restant / maxValue) * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[9px]">
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-400 rounded" />Dû</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-400 rounded" />Personnalisé</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-400 rounded" />Perçu</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-orange-400 rounded" />Restant</span>
      </div>
    </div>
  );
}

function RecoveryChart({ data }: { data: Array<{ className: string; taux: number; restant: number }> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-600" />Recouvrement par classe (top 10 à risque)</h3>
      <div className="space-y-2">
        {data.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">Aucune donnée disponible</p> : data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-600 w-20 truncate">{item.className}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${item.taux >= 80 ? 'bg-emerald-500' : item.taux >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(item.taux, 2)}%` }} />
            </div>
            <span className="text-[9px] font-bold text-slate-700 w-8 text-right">{item.taux}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionDonut({ totals }: { totals: any }) {
  const percu = totals.montantPercu || 0;
  const restant = totals.montantRestant || 0;
  const total = percu + restant;
  const percuPercent = total > 0 ? (percu / total) * 100 : 0;
  const cx = 80, cy = 80, r = 60, strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  const percuArc = (percuPercent / 100) * circumference;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-600" />Répartition Perçu / Restant</h3>
      <div className="flex items-center justify-center gap-6">
        <svg viewBox="0 0 160 160" className="w-40 h-40">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fb923c" strokeWidth={strokeWidth} />
          {percuPercent > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10b981" strokeWidth={strokeWidth} strokeDasharray={`${percuArc} ${circumference}`} strokeDashoffset={circumference / 4} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />}
          <text x={cx} y={cy - 5} textAnchor="middle" className="text-[16px] font-bold fill-emerald-600">{totals.tauxRecouvrement}%</text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="text-[8px] fill-slate-400 uppercase">Recouvrement</text>
        </svg>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500" /><div><p className="text-slate-500">Perçu</p><p className="font-bold text-emerald-700">{formatCurrency(percu)}</p></div></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-400" /><div><p className="text-slate-500">Restant</p><p className="font-bold text-orange-700">{formatCurrency(restant)}</p></div></div>
        </div>
      </div>
    </div>
  );
}
