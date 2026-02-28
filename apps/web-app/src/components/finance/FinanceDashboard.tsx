/**
 * Dashboard financier direction — KPI cards + bloc ORION (spec Academia Helm)
 */
'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertCircle,
  TrendingDown,
  Wallet,
  BarChart3,
  DollarSign,
  Brain,
  ChevronRight,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { SubModuleNavigation } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import Link from 'next/link';

const formatXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(n) + ' XOF';

function FinanceDashboardArrears({ academicYearId, schoolLevelId }: { academicYearId?: string; schoolLevelId?: string }) {
  const [arrears, setArrears] = useState<Array<{ id: string; balanceDue: number; arrearsLevel?: string; student?: { firstName?: string; lastName?: string } }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);
    fetch(`/api/finance/collection/arrears?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .then(setArrears)
      .catch(() => setArrears([]))
      .finally(() => setLoading(false));
  }, [academicYearId, schoolLevelId]);

  const topByStudent = arrears.slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-semibold text-gray-800">Top classes en retard</h3>
          <Link href="/app/finance/reports" className="text-sm text-blue-600 hover:underline">Rapports</Link>
        </div>
        <div className="p-4 min-h-[100px] text-sm text-gray-500">
          {loading ? 'Chargement...' : 'Regroupement par classe disponible dans Rapports financiers.'}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-semibold text-gray-800">Liste rapide comptes en retard</h3>
          <Link href="/app/finance/collection" className="text-sm text-blue-600 hover:underline">Recouvrement</Link>
        </div>
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : topByStudent.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun impayé.</p>
          ) : (
            <ul className="space-y-2">
              {topByStudent.map((a) => (
                <li key={a.id} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-800">
                    {a.student?.firstName} {a.student?.lastName}
                  </span>
                  <span className="text-red-700">{formatXOF(Number(a.balanceDue))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [kpis, setKpis] = useState<{
    totalEncaissement: number;
    totalDu: number;
    arrieres: number;
    tauxRecouvrement: number;
    depenses: number;
    soldeNet: number;
  } | null>(null);
  const [orionAlerts, setOrionAlerts] = useState<Array<{ level: string; title: string; message: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!academicYear?.id) return;
      setLoading(true);
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id) params.set('schoolLevelId', schoolLevel.id);

      try {
        const [treasuryRes, collectionRes, expensesRes, orionRes] = await Promise.all([
          fetch(`/api/finance/treasury/statistics?${params}`, { credentials: 'include' }),
          fetch(`/api/finance/collection/statistics?${params}`, { credentials: 'include' }),
          fetch(`/api/finance/expenses/statistics/summary?${params}`, { credentials: 'include' }),
          fetch(`/api/finance/orion/alerts?academicYearId=${academicYear.id}`, { credentials: 'include' }),
        ]);

        const treasury = treasuryRes.ok ? await treasuryRes.json() : {};
        const collection = collectionRes.ok ? await collectionRes.json() : {};
        const expenses = expensesRes.ok ? await expensesRes.json() : {};
        const alerts = orionRes.ok ? await orionRes.json() : [];

        const totalPaid = Number(treasury.totals?.collected ?? collection.totals?.paid ?? 0);
        const totalDue = Number(collection.totals?.expected ?? 0);
        const arrieres = Number(collection.totals?.balanceDue ?? 0);
        const depenses = Number(expenses.totals?.totalAmount ?? 0);
        const taux = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : (collection.totals?.collectionRate ?? 0);

        setKpis({
          totalEncaissement: totalPaid,
          totalDu: totalDue,
          arrieres,
          tauxRecouvrement: taux,
          depenses,
          soldeNet: totalPaid - depenses,
        });
        setOrionAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (e) {
        console.error('Finance dashboard load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [academicYear?.id, schoolLevel?.id]);

  const tabsForNav = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <SubModuleNavigation tabs={tabsForNav} currentPath="/app/finance" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Total encaissé</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {loading ? '—' : formatXOF(kpis?.totalEncaissement ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Total dû</span>
            <DollarSign className="w-5 h-5 text-navy-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {loading ? '—' : formatXOF(kpis?.totalDu ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Arriérés</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-xl font-bold text-red-700">
            {loading ? '—' : formatXOF(kpis?.arrieres ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Taux recouvrement</span>
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {loading ? '—' : `${kpis?.tauxRecouvrement ?? 0}%`}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Dépenses</span>
            <TrendingDown className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {loading ? '—' : formatXOF(kpis?.depenses ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Solde net</span>
            <Wallet className="w-5 h-5 text-navy-600" />
          </div>
          <p className={`text-xl font-bold ${(kpis?.soldeNet ?? 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {loading ? '—' : formatXOF(kpis?.soldeNet ?? 0)}
          </p>
        </div>
      </div>

      {/* Évolution mensuelle (placeholder — à brancher sur séries par mois) */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-slate-50">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Évolution mensuelle</h3>
        </div>
        <div className="p-4 min-h-[120px] flex items-center justify-center text-gray-500 text-sm">
          Courbe encaissement mensuel — à connecter aux données clôtures / paiements par mois.
        </div>
      </div>

      {/* ORION — Analyse financière */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-slate-50">
          <Brain className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-800">ORION — Analyse financière</h3>
        </div>
        <div className="p-4">
          {orionAlerts.length === 0 && !loading && (
            <p className="text-sm text-gray-500">Aucune alerte pour le moment.</p>
          )}
          {orionAlerts.length > 0 && (
            <ul className="space-y-2">
              {orionAlerts.slice(0, 8).map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 text-sm rounded-md px-3 py-2 ${
                    a.level === 'CRITICAL'
                      ? 'bg-red-50 text-red-800 border border-red-100'
                      : a.level === 'WARNING'
                        ? 'bg-amber-50 text-amber-800 border border-amber-100'
                        : 'bg-slate-50 text-slate-700 border border-slate-100'
                  }`}
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="text-gray-600">— {a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top classes en retard + Liste comptes en retard */}
      <FinanceDashboardArrears academicYearId={academicYear?.id} schoolLevelId={schoolLevel?.id} />

      {/* Accès rapide */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FINANCE_SUBMODULE_TABS.slice(0, 8).map((tab) => (
          <Link
            key={tab.id}
            href={tab.path}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <tab.icon className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <span className="font-medium text-gray-800">{tab.label}</span>
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
