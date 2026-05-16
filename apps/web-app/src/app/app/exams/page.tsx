/**
 * ============================================================================
 * MODULE 3 : EXAMENS, NOTES & BULLETINS - DASHBOARD STRATÉGIQUE
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  BarChart3,
  Calendar,
  ArrowRight,
  Clock,
  ShieldCheck,
  Award,
  Users,
  AlertCircle,
  Zap,
  Target
} from 'lucide-react';
import { 
  ModuleContainer 
} from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EXAMS_SUB_MODULES } from './sub-modules';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function ExamsDashboardPage() {
  const { academicYear, schoolLevel, tenant } = useModuleContext();
  const [kpi, setKpi] = useState<any>(null);
  const [completionData, setCompletionData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [orionInsights, setOrionInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      
      try {
        setLoading(true);
        const [kpiRes, completionRes, alertsRes, orionRes] = await Promise.all([
          institutionalExamsService.getDashboardKpi(schoolLevel.id, academicYear.id),
          institutionalExamsService.getCompletionByClass(schoolLevel.id, academicYear.id),
          institutionalExamsService.getAlerts(schoolLevel.id, academicYear.id),
          institutionalExamsService.getOrionInsights(schoolLevel.id, academicYear.id),
        ]);

        setKpi(kpiRes);
        setCompletionData(completionRes);
        setAlerts(alertsRes);
        setOrionInsights(orionRes);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [schoolLevel, academicYear]);

  return (
    <ModuleContainer
      header={{
        title: 'Examens, Notes & Bulletins',
        description: 'Moteur académique institutionnel : pilotage, performance et conformité.',
        icon: 'fileText',
      }}
      subModules={{
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'dashboard',
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6 p-1">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard 
                title="Évaluations Totales" 
                value={kpi?.totalEvaluations || 0} 
                icon={FileText} 
                color="indigo"
                description="Prévues pour la période"
                trend="+12% vs période préc."
              />
              <KpiCard 
                title="Attente Validation" 
                value={kpi?.pendingValidation || 0} 
                icon={ShieldCheck} 
                color="amber"
                description="Soumises par les enseignants"
                badge={kpi?.pendingValidation > 0 ? "Action Requise" : undefined}
              />
              <KpiCard 
                title="Notes Manquantes" 
                value={kpi?.missingGradesCount || 0} 
                icon={ClipboardList} 
                color="rose"
                description="Élèves sans note saisie"
                trend={kpi?.missingGradesCount > 100 ? "Attention" : undefined}
                trendColor="rose"
              />
              <KpiCard 
                title="Taux de Complétion" 
                value={`${Math.round(kpi?.completionRate || 0)}%`} 
                icon={TrendingUp} 
                color="emerald"
                description="Progression globale du cycle"
                progress={kpi?.completionRate || 0}
              />
            </div>

            {/* ORION Intelligence Section */}
            {orionInsights.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {orionInsights.map((insight, idx) => (
                  <Card key={idx} className={cn(
                    "border-l-4 shadow-sm overflow-hidden",
                    insight.priority === 'HIGH' ? "border-l-rose-500 bg-rose-50/30" : "border-l-amber-500 bg-amber-50/30"
                  )}>
                    <CardHeader className="pb-2">
                      <div className={cn(
                        "flex items-center space-x-2",
                        insight.priority === 'HIGH' ? "text-rose-700" : "text-amber-700"
                      )}>
                        <Zap className={cn("w-5 h-5", insight.priority === 'HIGH' ? "fill-rose-500" : "fill-amber-500")} />
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Intelligence ORION : {insight.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 font-medium">{insight.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Completion by Class */}
              <Card className="lg:col-span-2 border-none shadow-sm bg-white/60 backdrop-blur-md overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                      Complétion par Classe
                    </CardTitle>
                    <CardDescription>Progression de la saisie des notes par classe</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-indigo-600 font-bold hover:bg-indigo-50">
                    Détails <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-6">
                    {completionData.slice(0, 6).map((item, index) => (
                      <motion.div 
                        key={item.classId} 
                        className="space-y-2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex justify-between items-end text-sm font-bold">
                          <span className="flex items-center gap-2 text-gray-700">
                            <Users className="w-4 h-4 text-gray-400" />
                            {item.className}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            item.completion === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                          )}>
                            {Math.round(item.completion)}%
                          </span>
                        </div>
                        <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            className={cn(
                              "absolute h-full left-0 top-0 rounded-full",
                              item.completion === 100 ? "bg-emerald-500" : "bg-indigo-500"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.completion}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                          />
                        </div>
                      </motion.div>
                    ))}
                    {completionData.length === 0 && !loading && (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                        <BarChart3 className="w-12 h-12 mb-2 opacity-10" />
                        <p className="italic">Aucune donnée de complétion disponible</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Alerts and Delays */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-white/60 backdrop-blur-md overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center text-amber-900">
                      <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                      Alertes de Retard
                    </CardTitle>
                    <CardDescription>Évaluations en attente ({alerts.length})</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {alerts.map((alert, index) => (
                        <motion.div 
                          key={alert.id} 
                          className="flex items-start space-x-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100/50 hover:bg-amber-50 transition-colors"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="bg-white p-2 rounded-lg shadow-sm">
                            <Clock className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-900 truncate">{alert.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-200 text-amber-700 font-bold bg-white/50">
                                {alert.className}
                              </Badge>
                              <span className="text-[10px] text-amber-700/60 font-medium">
                                {format(new Date(alert.date), 'dd MMM', { locale: fr })}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-amber-500 text-white border-none shadow-sm">
                            +{alert.delayDays}j
                          </Badge>
                        </motion.div>
                      ))}
                      {alerts.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="bg-emerald-50 p-4 rounded-full mb-3 shadow-inner">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                          </div>
                          <p className="text-sm font-bold text-emerald-900">Excellente réactivité !</p>
                          <p className="text-xs text-emerald-700 mt-1">Aucun retard de saisie détecté.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-indigo-600 text-white overflow-hidden relative group">
                  <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center">
                      <Award className="w-5 h-5 mr-2" />
                      ORION Prochain Conseil
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-sm text-indigo-100 mb-4 leading-relaxed">
                      Le conseil de classe pour les <span className="font-bold text-white underline decoration-indigo-300">6ème A</span> est estimé dans 12 jours. 
                      Préparez les synthèses de notes.
                    </p>
                    <Button size="sm" className="w-full bg-white text-indigo-600 font-bold hover:bg-indigo-50 border-none shadow-lg">
                      Ouvrir le Planning
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ),
      }}
    />
  );
}

function KpiCard({ title, value, icon: Icon, color, description, badge, progress, trend, trendColor }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  const bgColors: any = {
    indigo: 'bg-indigo-600',
    amber: 'bg-amber-600',
    rose: 'bg-rose-600',
    emerald: 'bg-emerald-600',
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all relative">
      <div className={cn("absolute top-0 left-0 w-full h-1", bgColors[color] || 'bg-gray-200')} />
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-3 rounded-2xl border shadow-sm group-hover:scale-110 transition-transform", colors[color])}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex flex-col items-end gap-1">
            {badge && <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[10px] animate-pulse">{badge}</Badge>}
            {trend && (
              <span className={cn(
                "text-[10px] font-black uppercase tracking-wider",
                trendColor === 'rose' ? "text-rose-600" : "text-emerald-600"
              )}>
                {trend}
              </span>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{value}</span>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-1">{description}</p>
          {progress !== undefined && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-gray-400">
                <span>PROGRESSION</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  className={cn("h-full rounded-full", bgColors[color])}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
