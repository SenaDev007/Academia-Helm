/**
 * ============================================================================
 * CANTEEN REPORTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint stats : GET /modules-complementaires/canteen/dashboard?academicYearId=...
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - <input>/<button> HTML → <Input>/<Button> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - bandeau navy-900 → slate-900
 *  - SUPPRESSION DES MOCKS HARDCODED :
 *      * RECENT_REPORTS_MOCK (3 lignes) supprimé — la section "Rapports
 *        générés récemment" affiche "Aucun rapport généré" à la place.
 *      * Fallback hardcoded (12450 repas / 4.8 satisfaction / 2.1 waste)
 *        supprimé — KPIs désormais branchés sur useModulesDashboard('canteen')
 *        qui retourne déjà les vraies stats. Si aucune donnée n'est
 *        disponible, on affiche 0 / — / — au lieu de valeurs fictives.
 * ============================================================================
 */

'use client';

import React from 'react';
import {
  BarChart3, TrendingUp, Download,
  FileText, Share2,
  Users, Package,
  ArrowRight, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface CanteenDashboardStats {
  totalMeals?: number;
  servedMeals?: number;
  satisfaction?: number;
  satisfactionRate?: number;
  wasteRate?: number;
  waste?: number;
  totalRevenue?: number;
  revenue?: number;
  [key: string]: any;
}

export default function CanteenReports() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data, loading, error } = useModulesDashboard<CanteenDashboardStats>('canteen', academicYear?.id);

  // Task 7-d : plus de fallback hardcoded — on utilise les vraies données du dashboard.
  // Si la donnée est absente, on affiche 0 / — / — plutôt que 12450 / 4.8 / 2.1.
  const totalMeals = data?.totalMeals ?? data?.servedMeals ?? 0;
  const satisfaction = data?.satisfaction ?? data?.satisfactionRate;
  const wasteRate = data?.wasteRate ?? data?.waste;

  const handleGenerateReport = (title: string) => {
    toast({
      title: 'Génération de rapport',
      description: `Le rapport « ${title} » sera généré prochainement.`,
    });
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques depuis le serveur. Affichage des valeurs par défaut.
          <details className="mt-1 text-xs text-amber-700"><summary>Détail</summary>{error}</details>
        </div>
      )}

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportTemplateCard
          title="Rapport de Fréquentation"
          desc="Analyse quotidienne et hebdomadaire des repas servis."
          icon={Users}
          color="blue"
          onGenerate={() => handleGenerateReport('Rapport de Fréquentation')}
        />
        <ReportTemplateCard
          title="Bilan Financier Cantine"
          desc="Recettes, impayés et rentabilité du module."
          icon={TrendingUp}
          color="emerald"
          onGenerate={() => handleGenerateReport('Bilan Financier Cantine')}
        />
        <ReportTemplateCard
          title="État des Stocks & Achats"
          desc="Consommation réelle vs achats fournisseurs."
          icon={Package}
          color="amber"
          onGenerate={() => handleGenerateReport('État des Stocks & Achats')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Analytics Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-navy-900 text-lg">Analyse de Performance</h3>
                <p className="text-gray-500 text-xs mt-1">Évolution des repas servis ce mois-ci</p>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">Mai 2026</Button>
                <Button variant="outline" size="icon">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chart Placeholder */}
            <div className="h-64 bg-gradient-to-b from-gray-50 to-white rounded-xl border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-end justify-between px-12 pb-8">
                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                  <div key={i} className="w-8 bg-blue-100 rounded-t-lg" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <BarChart3 className="w-8 h-8 text-blue-300 mb-2 animate-pulse" />
                <p className="text-xs font-medium text-blue-400">Visualisation Interactive</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500">Total Repas</p>
                <p className="text-xl font-semibold text-navy-900">{totalMeals.toLocaleString('fr-FR')}</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-xs font-medium text-gray-500">Satisfaction</p>
                <p className="text-xl font-semibold text-emerald-600">
                  {satisfaction != null ? `${satisfaction}/5` : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500">Gaspillage</p>
                <p className="text-xl font-semibold text-red-500">
                  {wasteRate != null ? `${wasteRate}%` : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="font-semibold text-navy-900 mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <span>Rapports Générés Récemment</span>
            </h3>
            {/* RECENT_REPORTS_MOCK supprimé (Task 7-d) : aucun endpoint de liste
                des rapports disponible — message "Aucun rapport généré". */}
            <div className="text-center py-10 text-sm text-gray-500">
              Aucun rapport généré
            </div>
          </Card>
        </div>

        {/* Custom Report Builder Sidebar */}
        <Card className="p-6 bg-slate-900 text-white border-slate-800 shadow-md h-fit">
          <h4 className="text-lg font-semibold mb-2">Sarah AI Report Builder</h4>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            Générez des rapports personnalisés en demandant simplement à l’IA.
          </p>

          <div className="space-y-3 mb-6">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
              <p className="text-xs font-medium text-white/90">« Analyse du coût des repas par niveau scolaire sur les 3 derniers mois »</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
              <p className="text-xs font-medium text-white/90">« Comparaison de la consommation de viande vs poisson »</p>
            </div>
          </div>

          <div className="relative">
            <Input
              type="text"
              placeholder="Décrivez votre besoin..."
              className="bg-white/10 border-white/10 text-white placeholder-white/30 pr-12"
            />
            <Button
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-white text-slate-900 hover:bg-slate-100"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReportTemplateCard({ title, desc, icon: Icon, color, onGenerate }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <Card className="p-6 shadow-sm hover:shadow-md transition-all">
      <div className={`p-3 rounded-xl w-fit mb-4 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-semibold text-navy-900 text-base mb-2">{title}</h4>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">{desc}</p>
      <Button variant="link" size="sm" className="p-0 h-auto" onClick={onGenerate}>
        Générer
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </Card>
  );
}
