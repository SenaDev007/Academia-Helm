'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, PieChart, Loader2, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

export function ReportingWorkspace() {
  const { tenant, academicYear } = useModuleContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!tenant?.id || !academicYear?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await hrFetch<any>(hrUrl('overview/analytics', { tenantId: tenant.id, academicYearId: academicYear.id }));
        setData(res);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [tenant?.id, academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-[#1A2BA6] animate-spin" />
      </div>
    );
  }

  const snapshot = data?.snapshot || {};
  const evolution = data?.evolution || [];
  const distribution = data?.distribution || {};

  // Formatter for FCFA
  const formatCurrency = (val: any) => `${Number(val || 0).toLocaleString('fr-FR')} F`;

  // Map distribution data for Recharts
  const distributionData = [
    { name: 'Enseignants', count: distribution.teachers || snapshot.totalTeachers || 0 },
    { name: 'Administratif', count: distribution.admin || snapshot.totalAdmin || 0 },
    { name: 'Appui', count: distribution.support || 0 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Masse Salariale Mensuelle</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-[#1A2BA6]"><DollarSign className="h-5 w-5" /></span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(snapshot.monthlyPayroll)}</h3>
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Conforme au budget annuel
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cotisations CNSS</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600"><Award className="h-5 w-5" /></span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(snapshot.cnssContributions)}</h3>
            <p className="text-xs text-slate-500 mt-1">Part patronale & salariale consolidée</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Effectif Total RH</span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600"><Users className="h-5 w-5" /></span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{snapshot.totalStaff || 0} agents</h3>
            <p className="text-xs text-slate-500 mt-1">En poste ou sous contrat actif</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart - Payroll Evolution */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 text-sm">Évolution Temporelle de la Masse Salariale</h4>
          <div className="h-72 w-full">
            {evolution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Aucun historique disponible</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution}>
                  <defs>
                    <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tickFormatter={formatCurrency} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Masse Salariale']} />
                  <Area type="monotone" dataKey="amount" stroke={PRIMARY} strokeWidth={2.5} fillOpacity={1} fill="url(#colorPayroll)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart - Staff Distribution */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 text-sm">Répartition des Effectifs par Catégorie</h4>
          <div className="h-72 w-full flex flex-col justify-between">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
              {distributionData.map((d, i) => (
                <div key={d.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i === 0 ? PRIMARY : i === 1 ? ACCENT : '#10B981' }} />
                    <span className="text-slate-600 font-medium">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
