'use client';

import { useState, useEffect } from 'react';
import { Loader2, Landmark, AlertCircle, Users, Wallet, ShieldCheck, FileText, TrendingUp } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { formatCurrency } from '@/lib/utils';

export function TaxDashboard() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id || !currentYear?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any>(hrUrl('taxes/dashboard', { tenantId: tenant.id, academicYearId: currentYear.id }));
        setData(res);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenant?.id, currentYear?.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!data) return <div className="text-center text-slate-500 py-12">Aucune donnée disponible</div>;

  // ⭐ 156 — 4 STATISTIQUES RÉELLES : l'ancien tableau de bord affichait des
  // totaux des états financiers SYSCOHADA saisis À LA MAIN (donc 0 tant que le
  // bilan n'est pas rempli). Les KPIs sont désormais calculés depuis les
  // DONNÉES RÉELLES de l'école : paie générée, cotisations CNSS des fiches,
  // effectif (permanents = déclarés CNSS / vacataires = prestataires & non
  // déclarés) et charges fiscales de TOUTES les déclarations.
  const effectif = data.effectif || { permanents: 0, vacataires: 0, total: 0 };
  const cotisationsCnss = data.cotisationsCnss || { ouvriere: 0, patronale: 0, total: 0 };
  const kpis = [
    {
      label: 'Masse salariale (année)',
      value: formatCurrency(data.masseSalariale || 0),
      sub: data.lignesDePaie ? `${data.lignesDePaie} ligne(s) de paie` : 'Depuis la paie générée',
      icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50',
    },
    {
      label: 'Cotisations CNSS',
      value: formatCurrency(cotisationsCnss.total || 0),
      sub: `Ouvrière ${formatCurrency(cotisationsCnss.ouvriere || 0)} + patronale ${formatCurrency(cotisationsCnss.patronale || 0)}`,
      icon: ShieldCheck, color: 'text-[#1A2BA6]', bg: 'bg-indigo-50',
    },
    {
      label: 'Charges fiscales',
      value: formatCurrency(data.totalTax || 0),
      sub: `${data.declarationsCount || 0} déclaration(s) — ${data.pendingDeclarations || 0} en brouillon`,
      icon: Landmark, color: 'text-amber-600', bg: 'bg-amber-50',
    },
    {
      label: 'Effectif du personnel',
      value: `${effectif.total}`,
      sub: `${effectif.permanents} permanent(s) déclaré(s) CNSS · ${effectif.vacataires} vacataire(s)`,
      icon: Users, color: 'text-purple-600', bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              {kpi.sub && <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{kpi.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Alertes */}
      {data.pendingDeclarations > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">{data.pendingDeclarations} déclaration(s) en brouillon</p>
            <p className="text-xs text-amber-700">Pensez à finaliser et soumettre vos déclarations fiscales.</p>
          </div>
        </div>
      )}

      {/* Info année académique + paie */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" /> Année académique : {currentYear?.name || 'N/A'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Net versé (paie)</p>
            <p className="font-bold text-emerald-600">{formatCurrency(data.netVerse || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Déclarations totales</p>
            <p className="font-bold text-slate-900">{data.declarationsCount || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">En attente</p>
            <p className="font-bold text-amber-600">{data.pendingDeclarations || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vacataires (prestataires)</p>
            <p className="font-bold text-purple-600">{effectif.vacataires}</p>
          </div>
        </div>
      </div>

      {/* États financiers SYSCOHADA (saisie manuelle) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" /> États financiers SYSCOHADA
          <span className="text-[10px] font-medium text-slate-400 normal-case">(saisis manuellement dans l&apos;onglet « États financiers »)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Total Actif</p>
            <p className="font-bold text-blue-600 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{formatCurrency(data.totalActif || 0)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Total Passif</p>
            <p className="font-bold text-purple-600">{formatCurrency(data.totalPassif || 0)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Résultat Net</p>
            <p className={`font-bold ${(data.resultatNet || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(data.resultatNet || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
