/**
 * ============================================================================
 * EDUCAST REPORTS
 * ============================================================================
 *
 * Refonte juillet 2026 :
 * 1. ⭐ MOCKS SUPPRIMÉS : le tableau `reports` de 4 entrées codées en dur (Rapport
 *    d'Engagement Mensuel - Mai 2026, Statistiques de consultation par Classe,
 *    Audit Modération, Performance des contenus Enseignants) est supprimé. La
 *    section affiche désormais "Aucun rapport généré" si l'API ne renvoie rien
 *    (aucun endpoint GET /educast/reports disponible à ce jour).
 * 2. ⭐ FIX PAYLOAD REPORTTYPE : le POST /educast/reports envoyait { type: 'GLOBAL' }
 *    mais le backend attend `reportType`. Corrigé pour envoyer { reportType: 'GLOBAL' }.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { FileText, Download, Printer, Share2, PieChart, BarChart, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EduCastReportsList {
  reports?: Array<{
    id: string | number;
    title?: string;
    type?: string;
    reportType?: string;
    date?: string;
    createdAt?: string;
    size?: string;
  }>;
}

export default function EduCastReports() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  // On tente de récupérer les rapports existants via useModulesDashboard (GET /educast/stats ou /educast/dashboard).
  // L'API peut renvoyer un champ `reports` si elle existe — sinon on affiche "Aucun rapport généré".
  const { data, loading } = useModulesDashboard<EduCastReportsList>('educast', academicYear?.id);
  const reports = data?.reports ?? [];

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      // ⭐ FIX PAYLOAD : le backend attend `reportType` (et non `type`)
      await modulesApi.post(
        'educast/reports',
        { reportType: 'GLOBAL' },
        buildModulesApiOptions(academicYear?.id),
      );
      toast({ title: 'Rapport généré', description: 'Le rapport global a été généré avec succès.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la génération du rapport', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-navy-900 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-600" />
          Rapports EduCast
        </h3>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
          Générer Rapport
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 shadow-sm flex items-center gap-4 group hover:border-blue-200 transition-all cursor-pointer">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
            <PieChart className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-900">Résumé Analytique</h4>
            <p className="text-xs text-slate-500">Générer un PDF complet des KPIs</p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm flex items-center gap-4 group hover:border-emerald-200 transition-all cursor-pointer">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <BarChart className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-900">Export de Données</h4>
            <p className="text-xs text-slate-500">Télécharger les vues au format Excel/CSV</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <Card className="p-8 text-center text-slate-400 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Chargement des rapports...
          </Card>
        ) : reports.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 shadow-sm">
            Aucun rapport généré pour cette année scolaire.
          </Card>
        ) : (
          reports.map((report, i) => {
            const title = report.title || 'Rapport';
            const type = report.reportType || report.type || 'GLOBAL';
            const date = report.date || (report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : '—');
            const size = report.size || '—';
            return (
              <Card key={report.id ?? i} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-md transition-all group shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                    <FileText className="w-7 h-7 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{type}</Badge>
                      <span className="text-xs text-slate-500">{date}</span>
                      <span className="text-xs text-slate-500">{size}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Download className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
