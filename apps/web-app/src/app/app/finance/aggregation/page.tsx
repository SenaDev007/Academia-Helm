'use client';

import { useState, useEffect } from 'react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { Loader2, TrendingUp, TrendingDown, Wallet, AlertCircle, BarChart3 } from 'lucide-react';
import { AggregationPageShell } from '@/components/aggregation/AggregationPageShell';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

interface LevelFinanceStats {
  levelId: string;
  levelCode: string;
  levelLabel: string;
  totalEncaissements: number;
  totalRecouvrements: number;
  totalDecaissements: number;
  tresorerie: number;
  impayes: number;
}

export default function FinanceAggregationPage() {
  const { academicYear, tenant } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [stats, setStats] = useState<LevelFinanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYear?.id || !tenant?.id) return;
    fetchAggregation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, tenant?.id]);

  async function fetchAggregation() {
    try {
      setLoading(true);
      setError(null);
      // Récupérer les stats pour chaque niveau scolaire activé
      const realLevels = availableLevels.filter((l: any) => l.id !== 'ALL' && l.isActive);
      const results: LevelFinanceStats[] = [];

      for (const level of realLevels) {
        try {
          const params = new URLSearchParams({
            tenantId: tenant!.id,
            academicYearId: academicYear!.id,
            schoolLevelId: level.id,
          });
          const res = await fetch(`/api/finance/reports?${params.toString()}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalEncaissements: data?.totalPaid ?? data?.totalEncaissements ?? 0,
              totalRecouvrements: data?.totalRecovered ?? 0,
              totalDecaissements: data?.totalExpenses ?? 0,
              tresorerie: (data?.totalPaid ?? 0) - (data?.totalExpenses ?? 0),
              impayes: data?.totalDue ?? data?.totalUnpaid ?? 0,
            });
          } else {
            // Fallback si l'endpoint n'existe pas
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalEncaissements: 0,
              totalRecouvrements: 0,
              totalDecaissements: 0,
              tresorerie: 0,
              impayes: 0,
            });
          }
        } catch {
          results.push({
            levelId: level.id,
            levelCode: level.code,
            levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
            totalEncaissements: 0,
            totalRecouvrements: 0,
            totalDecaissements: 0,
            tresorerie: 0,
            impayes: 0,
          });
        }
      }

      setStats(results);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  const totals = stats.reduce(
    (acc, s) => ({
      totalEncaissements: acc.totalEncaissements + s.totalEncaissements,
      totalRecouvrements: acc.totalRecouvrements + s.totalRecouvrements,
      totalDecaissements: acc.totalDecaissements + s.totalDecaissements,
      tresorerie: acc.tresorerie + s.tresorerie,
      impayes: acc.impayes + s.impayes,
    }),
    { totalEncaissements: 0, totalRecouvrements: 0, totalDecaissements: 0, tresorerie: 0, impayes: 0 },
  );

  const formatAmount = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';


  const content = loading ? (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement du bilan global...</span>
      </div>
  ) : (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agrégation & Bilan Global</h1>
          <p className="text-sm text-gray-500">
            Bilan financier de tous les niveaux scolaires confondus — {academicYear?.name || 'Année courante'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ {error}
        </div>
      )}

      {/* KPI Cards — Totaux tous niveaux */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Encaissements</p>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700">{formatAmount(totals.totalEncaissements)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Recouvrements</p>
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-700">{formatAmount(totals.totalRecouvrements)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Décaissements</p>
            <TrendingDown className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-700">{formatAmount(totals.totalDecaissements)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Trésorerie Globale</p>
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-xl font-black ${totals.tresorerie >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {formatAmount(totals.tresorerie)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Impayés</p>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-xl font-black text-red-700">{formatAmount(totals.impayes)}</p>
        </div>
      </div>

      {/* Tableau comparatif par niveau */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 p-6 border-b border-slate-100">
          Répartition par niveau scolaire
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Niveau</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Encaissements</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Recouvrements</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Décaissements</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Trésorerie</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Impayés</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.levelId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.levelLabel}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-medium">{formatAmount(s.totalEncaissements)}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-700 font-medium">{formatAmount(s.totalRecouvrements)}</td>
                  <td className="px-6 py-4 text-sm text-right text-rose-700 font-medium">{formatAmount(s.totalDecaissements)}</td>
                  <td className={`px-6 py-4 text-sm text-right font-bold ${s.tresorerie >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatAmount(s.tresorerie)}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-700 font-medium">{formatAmount(s.impayes)}</td>
                </tr>
              ))}
              {/* Ligne des totaux */}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-6 py-4 text-sm font-black text-blue-900">TOTAL TOUS NIVEAUX</td>
                <td className="px-6 py-4 text-sm text-right font-black text-emerald-700">{formatAmount(totals.totalEncaissements)}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-amber-700">{formatAmount(totals.totalRecouvrements)}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-rose-700">{formatAmount(totals.totalDecaissements)}</td>
                <td className={`px-6 py-4 text-sm text-right font-black ${totals.tresorerie >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatAmount(totals.tresorerie)}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-red-700">{formatAmount(totals.impayes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-slate-200">
          Aucun niveau scolaire activé. Activez au moins un niveau dans Paramètres → Structure.
        </div>
      )}
    </div>
  );
  return (
    <AggregationPageShell
      moduleTitle='Finances & Économat'
      moduleDescription='Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage.'
      moduleIcon='finance'
      tabs={FINANCE_SUBMODULE_TABS}
      activeTabId='aggregation'
    >
      {content}
    </AggregationPageShell>
  );
}
