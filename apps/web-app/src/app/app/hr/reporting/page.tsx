/**
 * ============================================================================
 * HR MODULE - REPORTING & ANALYTICS PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Download,
  Calendar,
  Filter,
  FileText
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportingPage() {
  const { tenant, academicYear } = useModuleContext();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const result = await apiFetch<any>(`/hr/overview/analytics?tenantId=${tenant.id}&academicYearId=${academicYear?.id}`);
        setAnalytics(result);
      } catch (error) {
        console.error('Error fetching HR analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [tenant?.id, academicYear?.id]);

  if (loading) return <div className="p-8 text-center animate-pulse">Chargement des analyses...</div>;

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Rapports & Audit RH"
        description="Analyses stratégiques, évolution de la masse salariale et distribution des effectifs."
        icon="rh"
        kpis={[
          { label: 'Croissance effectif', value: '+4%', unit: '/ an' },
          { label: 'Coût moyen / employé', value: '245k', unit: 'XOF' },
          { label: 'Taux de rotation', value: '2.1%', unit: '' },
        ]}
      />

      <div className="px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution de la masse salariale */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white p-6">
          <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Évolution de la masse salariale
            </CardTitle>
            <div className="flex gap-2">
              <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-600"><Download size={16} /></button>
            </div>
          </CardHeader>
          <div className="h-64 flex items-end justify-between gap-2 pt-4 px-2">
            {analytics?.evolution?.map((item: any, i: number) => {
              const max = Math.max(...analytics.evolution.map((e: any) => e.total));
              const height = (item.total / max) * 100;
              return (
                <div key={i} className="flex-grow flex flex-col items-center group">
                  <div className="w-full bg-blue-50 rounded-t-lg group-hover:bg-blue-600 transition-all relative" style={{ height: `${height}%` }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {item.total.toLocaleString()} XOF
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase">{item.month.substring(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Distribution des effectifs */}
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <PieChart size={20} className="text-emerald-600" />
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <div className="space-y-6">
            {analytics?.distribution?.map((item: any, i: number) => {
              const total = analytics.distribution.reduce((sum: number, d: any) => sum + d.count, 0);
              const percent = (item.count / total) * 100;
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-600 uppercase text-[10px] tracking-wider">{item.category}</span>
                    <span className="text-gray-900">{item.count} ({Math.round(percent)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Rapports à exporter */}
        <Card className="lg:col-span-3 border-none shadow-sm rounded-3xl bg-white p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Génération de rapports périodiques
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Livre de Paie', desc: 'Récapitulatif mensuel complet', icon: DollarSign },
              { title: 'Bilan Social', desc: 'Statistiques annuelles RH', icon: Users },
              { title: 'Déclaration IRPP', desc: 'Fichier fiscal consolidé', icon: FileText },
              { title: 'État de Présence', desc: 'Cumul des absences et retards', icon: Calendar },
            ].map((report, i) => (
              <div key={i} className="p-4 rounded-2xl border border-gray-50 bg-gray-50/50 hover:bg-blue-50 hover:border-blue-100 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-blue-600 mb-3 shadow-sm transition-colors">
                  <report.icon size={20} />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">{report.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{report.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
