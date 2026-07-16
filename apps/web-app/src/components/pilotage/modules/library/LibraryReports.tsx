/**
 * ============================================================================
 * LIBRARY REPORTS & STATS — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint stats       : GET  /modules-complementaires/library/dashboard
 * Endpoint génération  : POST /modules-complementaires/library/reports
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { BarChart3, FileText, Download, Calendar, Printer, Share2, TrendingUp, Filter, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface LibraryDashboardStats {
  rotationRate?: number;
  averageLoanDuration?: number;
  maxLoanDuration?: number;
  penaltyRevenue?: number;
  totalRevenue?: number;
  [key: string]: any;
}

// TODO: endpoint liste des rapports non disponible — garder mock
const REPORTS_MOCK = [
  { title: 'Rapport Annuel de Fréquentation', type: 'COMPLET', date: '01/01/2026', size: '2.4 MB', author: 'Logiciel System' },
  { title: 'Analyse des Retards et Pénalités', type: 'FINANCE', date: '12/05/2026', size: '1.1 MB', author: 'Sarah AI' },
  { title: 'Inventaire Physique - Section Littérature', type: 'INVENTAIRE', date: '10/05/2026', size: '850 KB', author: 'Admin' },
];

export default function LibraryReports() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data, loading, error } = useModulesDashboard<LibraryDashboardStats>('library', academicYear?.id);
  const [generating, setGenerating] = useState(false);

  const rotationRate = data?.rotationRate ?? 68;
  const avgLoanDays = data?.averageLoanDuration ?? 9.2;
  const maxLoanDays = data?.maxLoanDuration ?? 14;
  const penaltyRevenue = data?.penaltyRevenue ?? data?.totalRevenue ?? 42500;

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      await modulesApi.post(
        'library/reports',
        { generatedAt: new Date().toISOString() },
        buildModulesApiOptions(academicYear?.id),
      );
      toast({ title: 'Rapport généré', description: 'Le rapport a été généré avec succès.' });
    } catch (e: any) {
      console.error('Erreur génération rapport :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la génération du rapport', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des statistiques...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques depuis le serveur. Affichage des valeurs par défaut.
          <details className="mt-1 text-xs text-amber-700"><summary>Détail</summary>{error}</details>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-medium text-slate-400">Taux de Rotation</h4>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-semibold text-slate-900 mb-2">{rotationRate}%</div>
          <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100">+12% vs mois dernier</Badge>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-medium text-slate-400">Temps Moyen Emprunt</h4>
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-semibold text-slate-900 mb-2">{avgLoanDays} Jours</div>
          <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-100">Dans les limites ({maxLoanDays}j)</Badge>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-medium text-slate-400">Recettes Pénalités</h4>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-semibold text-slate-900 mb-2">{penaltyRevenue.toLocaleString('fr-FR')} F CFA</div>
          <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-100">Mois en cours</Badge>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
          Rapports Générés
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button onClick={handleGenerateReport} disabled={generating}>
            <Printer className="w-4 h-4 mr-2" />
            {generating ? 'Génération…' : 'Nouveau Rapport'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {REPORTS_MOCK.map((report, i) => (
          <Card key={i} className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all">
            <div className="flex items-center gap-6 flex-1">
              <div className="p-4 bg-slate-50 rounded-xl">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900 leading-tight">{report.title}</h4>
                <div className="flex items-center gap-4 mt-1">
                  <Badge variant="outline" className="text-blue-600">{report.type}</Badge>
                  <span className="text-xs text-slate-400">• {report.date}</span>
                  <span className="text-xs text-slate-400">• {report.size}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Download className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon">
                <Printer className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
