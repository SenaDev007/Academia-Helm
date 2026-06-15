/**
 * ============================================================================
 * ACADEMIA HELM - FINANCE REPORTS CONTENT
 * Rapports avancés et cockpit stratégique (Spec Premium)
 * ============================================================================
 */
'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  BarChart3, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Calendar,
  Layers,
  Archive
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

export default function FinanceReportsContent() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [kpi, setKpi] = useState<any>(null);
  const [classData, setClassData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academicYear?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ academicYearId: academicYear.id });
    
    Promise.all([
      financeService.getKpiReports(Object.fromEntries(params.entries())),
      financeService.getClassEncaissements(Object.fromEntries(params.entries())),
      financeService.getExpenseByCategory(Object.fromEntries(params.entries()))
    ]).then(([k, c, e]) => {
      setKpi(k);
      setClassData(Array.isArray(c) ? c : []);
      setExpenseData(Array.isArray(e) ? e : []);
    }).catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [academicYear?.id]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const handleExport = async (type: string) => {
    if (!academicYear?.id) return;
    try {
      await financeService.exportReports({
        academicYearId: academicYear.id,
        reportType: type,
      });
      toast({ title: 'Export lancé', description: `L'export ${type} est en cours. Le fichier sera disponible dans vos téléchargements.` });
    } catch (err: any) {
      toast({ title: 'Erreur export', description: err?.message || 'Impossible de lancer l\'export', variant: 'destructive' });
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cockpit Stratégique</h2>
          <p className="text-sm text-slate-500 font-medium">Analyse consolidée {academicYear?.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 shadow-sm">
            <Filter className="w-4 h-4 mr-2" /> Filtrer
          </Button>
          <Button 
            onClick={() => handleExport('CONSOLIDATED_FINANCE_PDF')}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200"
          >
            <Download className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Prévisionnel Annuel" 
          value={kpi?.totalDue ?? 0} 
          icon={<Calendar className="w-5 h-5" />} 
          color="blue" 
        />
        <KPICard 
          title="Recettes Réelles" 
          value={kpi?.totalPaid ?? 0} 
          icon={<ArrowUpRight className="w-5 h-5" />} 
          color="emerald" 
          trend="+5.2%"
        />
        <KPICard 
          title="Reste à Recouvrer" 
          value={(kpi?.totalDue ?? 0) - (kpi?.totalPaid ?? 0)} 
          icon={<Archive className="w-5 h-5" />} 
          color="rose" 
        />
        <KPICard 
          title="Taux de Règlement" 
          value={`${kpi?.tauxRecouvrement ?? 0}%`} 
          isCurrency={false}
          icon={<BarChart3 className="w-5 h-5" />} 
          color="amber" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recettes par Classe */}
        <Card className="rounded-[2rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              Répartition par Classe
            </CardTitle>
            <CardDescription>Analyse des encaissements par section pédagogique</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />)}
              </div>
            ) : classData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic">Aucune donnée disponible.</div>
            ) : (
              <div className="space-y-6">
                {classData.slice(0, 6).map((c, i) => {
                  const max = Math.max(...classData.map(x => x.total), 1);
                  const percent = (c.total / max) * 100;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-slate-700">{c.className}</span>
                        <span className="text-xs font-black text-slate-900">{formatCurrency(c.total)}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: 0.2 + i * 0.1, duration: 1, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dépenses par Catégorie */}
        <Card className="rounded-[2rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-rose-500" />
              Analyse des Dépenses
            </CardTitle>
            <CardDescription>Répartition budgétaire par catégorie de sortie</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />)}
              </div>
            ) : expenseData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic">Aucune dépense enregistrée.</div>
            ) : (
              <div className="space-y-6">
                {expenseData.slice(0, 6).map((e, i) => {
                  const max = Math.max(...expenseData.map(x => x.total), 1);
                  const percent = (e.total / max) * 100;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-tighter">{e.category}</span>
                        <span className="text-xs font-black text-rose-600">{formatCurrency(e.total)}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: 0.2 + i * 0.1, duration: 1, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportLink 
          title="Bilan Périodique" 
          description="Export complet des transactions par mois." 
          icon={<FileText className="w-5 h-5" />} 
        />
        <ReportLink 
          title="État des Arriérés" 
          description="Liste nominative des élèves en retard." 
          icon={<Archive className="w-5 h-5" />} 
        />
        <ReportLink 
          title="Journal de Caisse" 
          description="Détail des opérations par caissier." 
          icon={<BarChart3 className="w-5 h-5" />} 
        />
      </div>
    </motion.div>
  );
}

function KPICard({ title, value, icon, color, trend, isCurrency = true }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    rose: "bg-rose-50 border-rose-100 text-rose-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600"
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
        {trend && (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
            <ArrowUpRight className="w-3 h-3 mr-1" /> {trend}
          </Badge>
        )}
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-xl font-black text-slate-900 tracking-tight">
        {isCurrency && typeof value === 'number' ? formatCurrency(value) : value}
      </h3>
    </motion.div>
  );
}

function ReportLink({ title, description, icon }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4 cursor-pointer hover:border-blue-200 transition-colors"
    >
      <div className="p-3 rounded-2xl bg-slate-50 text-slate-600">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
    </motion.div>
  );
}
