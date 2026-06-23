'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Wallet, FileText, AlertCircle, Users, Landmark } from 'lucide-react';
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

  const kpis = [
    { label: 'Total Actif', value: formatCurrency(data.totalActif || 0), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Passif', value: formatCurrency(data.totalPassif || 0), icon: TrendingUp, icon2: true, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Résultat Net', value: formatCurrency(data.resultatNet || 0), icon: FileText, color: data.resultatNet >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.resultatNet >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Charges fiscales', value: formatCurrency(data.totalTax || 0), icon: Landmark, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Info année académique */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" /> Année académique : {currentYear?.name || 'N/A'}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Déclarations totales</p>
            <p className="font-bold text-slate-900">{data.declarationsCount || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">En attente</p>
            <p className="font-bold text-amber-600">{data.pendingDeclarations || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
