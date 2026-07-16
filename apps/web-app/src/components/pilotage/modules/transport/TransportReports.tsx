'use client';

import { FileBarChart, Download, TrendingUp, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// Rapports statiques (templates) — pas d'endpoint GET dédié pour la liste de rapports générés.
// Les statistiques de performance flotte proviennent du dashboard du module transport.
const REPORT_TEMPLATES = [
  { title: 'Rapport journalier des trajets', date: '15/05/2026', type: 'Daily' },
  { title: 'Synthèse mensuelle des présences', date: 'Avril 2026', type: 'Monthly' },
  { title: 'Audit de maintenance flotte', date: 'T1 2026', type: 'Quarterly' },
  { title: 'Rapport financier transport', date: 'Mai 2026', type: 'Financial' },
];

interface TransportDashboard {
  fleetPerformance?: Array<{ month?: string; label?: string; val?: number; value?: number }>;
  monthlyPerformance?: Array<{ month?: string; label?: string; val?: number; value?: number }>;
  [key: string]: any;
}

export default function TransportReports() {
  const { academicYear } = useModuleContext();
  const { data: dashboard, loading, error } = useModulesDashboard<TransportDashboard>('transport', academicYear?.id);
  const { toast } = useToast();

  // Données de performance flotte depuis le dashboard.
  // Si le backend ne renvoie rien, on affiche des barres vides (0%) — pas de valeurs
  // fictives hardcodées (les anciennes valeurs 45/65/35/85/75/95/60 ont été supprimées
  // en Task 7-e : on ne triche plus les données).
  const rawPerf = dashboard?.fleetPerformance || dashboard?.monthlyPerformance;
  const performanceData = Array.isArray(rawPerf) && rawPerf.length > 0
    ? rawPerf.map((d, i) => ({
        month: d.month || d.label || `M${i + 1}`,
        val: d.val ?? d.value ?? 0,
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  const handleGenerate = (title: string) => {
    toast({
      title: 'Rapport en cours de génération',
      description: `${title} sera disponible dans quelques instants.`,
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-indigo-700" /> Rapports & Statistiques
        </h3>
        <Button onClick={() => handleGenerate('Nouveau rapport personnalisé')}>
          Générer un nouveau rapport
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TEMPLATES.map((report, i) => (
          <Card key={i} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className="p-3 bg-gray-50 rounded-xl text-gray-500 mb-4 w-fit">
              <Download className="w-5 h-5" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-2 leading-tight">{report.title}</h4>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">{report.date}</span>
              <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">
                {report.type}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={() => handleGenerate(report.title)}
            >
              <Download className="w-3 h-3 mr-2" /> Télécharger
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-semibold text-gray-900">Performances Flotte (Mensuel)</h4>
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        {performanceData.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            Aucune donnée de performance disponible. Les statistiques apparaîtront ici une fois le
            transport actif.
          </div>
        ) : (
          <div className="h-64 flex items-end justify-between gap-4">
            {performanceData.map((d, i) => (
              <div key={i} className="flex-1 space-y-2">
                <div className="w-full bg-gray-50 rounded-t-xl group relative cursor-pointer">
                  <div
                    className="bg-indigo-600 rounded-t-xl transition-all duration-500 hover:bg-emerald-500"
                    style={{ height: `${d.val}%` }}
                  />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.val}%
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">{d.month}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
