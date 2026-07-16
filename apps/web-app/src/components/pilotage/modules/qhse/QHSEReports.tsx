/**
 * ============================================================================
 * QHSE REPORTS & ANALYTICS (Standardisé)
 * ============================================================================
 */

'use client';

import { Download, FileText, PieChart, Printer, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface QHSEDashboardData {
  reports?: Array<{
    id: string | number;
    title?: string;
    type?: string;
    date?: string;
    author?: string;
    size?: string;
  }>;
  incidentsByCategory?: Array<{ label: string; value: number; color?: string }>;
  totalIncidents?: number;
}

export default function QHSEReports() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: dashboard, loading, error } = useModulesDashboard<QHSEDashboardData>('qhse', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des rapports QHSE...</span>
      </div>
    );
  }

  const reports = dashboard?.reports ?? [];
  const incidentsByCategory = dashboard?.incidentsByCategory ?? [
    { label: 'Sécurité', value: 38, color: 'bg-rose-500' },
    { label: 'Hygiène', value: 25, color: 'bg-amber-400' },
    { label: 'Environnement', value: 21, color: 'bg-emerald-500' },
  ];
  const totalIncidents = dashboard?.totalIncidents ?? incidentsByCategory.reduce((acc, x) => acc + x.value, 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      {/* Analytics Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Répartition Incidents</h4>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="aspect-square flex items-center justify-center relative">
            <div className="w-full h-full rounded-full border-[1.5rem] border-emerald-500 border-t-rose-500 border-r-amber-400 opacity-20" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-semibold text-slate-900">{totalIncidents}</p>
              <p className="text-xs text-slate-400">Total An</p>
            </div>
          </div>
          <div className="space-y-2">
            {incidentsByCategory.map((cat, i) => {
              const pct = totalIncidents > 0 ? Math.round((cat.value / totalIncidents) * 100) : 0;
              const colorClass = cat.color || (i === 0 ? 'bg-rose-500' : i === 1 ? 'bg-amber-400' : 'bg-emerald-500');
              return (
                <div key={i} className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${colorClass}`} /> {cat.label} ({pct}%)</span>
                  <span className="text-slate-900 font-semibold">{cat.value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Générateur de Rapports</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Printer className="w-5 h-5" />
              </Button>
              <Button
                onClick={() => toast({ title: 'Information', description: 'Génération rapport — fonctionnalité à venir.' })}
              >
                Nouveau Rapport
              </Button>
            </div>
          </div>

          {reports.length === 0 ? (
            <Card className="text-center py-16 text-slate-500 shadow-sm">
              Aucun rapport QHSE disponible pour cette année scolaire.
            </Card>
          ) : (
            <Card className="shadow-sm overflow-hidden">
              {reports.map((report, i) => (
                <div key={report.id ?? i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 leading-tight">{report.title || 'Rapport'}</p>
                      <p className="text-xs text-slate-400 mt-1">Par {report.author || '—'} • {report.size || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <Badge variant="outline">{report.type || '—'}</Badge>
                      <p className="text-xs text-slate-400 mt-1">{report.date || '—'}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600">
                      <Download className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
