/**
 * ============================================================================
 * MODULE 3 : ANALYTIQUES & ORION
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  AlertCircle,
  Zap,
  TrendingDown,
  PieChart,
  LineChart,
  Loader2,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules } from '../layout';
import { useExamScope } from '../layout';
import { institutionalExamsService } from '@/services/institutional-exams.service';

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

interface LevelPerformance {
  levelCode: string;
  levelLabel: string;
  average: number;
  passRate: number;
  studentsAtRisk: number;
}

interface OrionInsight {
  type: 'ALERT' | 'SUCCESS';
  title: string;
  message: string;
  badge: string;
}

export default function AnalyticsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const { academicYear, tenant } = useModuleContext();
  const [loading, setLoading] = useState(true);
  const [performances, setPerformances] = useState<LevelPerformance[]>([]);
  const [insights, setInsights] = useState<OrionInsight[]>([]);
  const [globalStats, setGlobalStats] = useState({
    passRate: 0,
    studentsAtRisk: 0,
    totalExams: 0,
    averageScore: 0,
  });

  useEffect(() => {
    if (!academicYear?.id || !tenant?.id) return;
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, tenant?.id, scopeLang]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      // ⭐ V1 audit — l'ancien appel /api/exams/dashboard était triple cassé :
      //    route BFF inexistante (captée par /api/exams/[id]), proxy sans
      //    forwarding d'auth (401) et tables legacy jamais alimentées →
      //    l'onglet affichait des zéros en silence. On appelle désormais le
      //    nouvel endpoint performance-by-level (données réelles
      //    StudentPeriodAverage + Evaluation, scope niveau + piste).
      const rows: any[] = await institutionalExamsService.getPerformanceByLevel(
        academicYear!.id,
        scopeLang || undefined,
      );
      const results: LevelPerformance[] = (rows || []).map((d: any) => ({
        levelCode: d.levelCode,
        levelLabel: LEVEL_LABELS[d.levelCode] || d.levelLabel || d.levelCode,
        average: Number(d.average ?? 0),
        passRate: Number(d.passRate ?? 0),
        studentsAtRisk: Number(d.studentsAtRisk ?? 0),
      }));

      const collectedInsights: OrionInsight[] = [];
      let totalPassRate = 0;
      let totalStudentsAtRisk = 0;
      let totalExams = 0;
      let totalAverage = 0;
      for (const r of results) {
        totalPassRate += r.passRate;
        totalStudentsAtRisk += r.studentsAtRisk;
        totalAverage += r.average;
        totalExams += Number((rows.find((d: any) => d.levelCode === r.levelCode) as any)?.totalExams ?? 0);

        // Générer des insights basés sur les données réelles
        if (r.average > 0 && r.average < 8) {
          collectedInsights.push({
            type: 'ALERT',
            title: `Chute de performance — ${r.levelLabel}`,
            message: `La moyenne du niveau ${r.levelLabel} est de ${r.average.toFixed(2)}/20, en dessous du seuil critique de 8/20. Une analyse pédagogique est requise.`,
            badge: 'Analyse Requise',
          });
        }
        if (r.passRate >= 80) {
          collectedInsights.push({
            type: 'SUCCESS',
            title: `Taux de réussite élevé — ${r.levelLabel}`,
            message: `Le niveau ${r.levelLabel} affiche un taux de réussite de ${r.passRate.toFixed(1)}%, supérieur à l'objectif de 80%.`,
            badge: 'Impact Positif',
          });
        }
      }

      setPerformances(results);
      setInsights(collectedInsights);
      setGlobalStats({
        passRate: results.length > 0 ? totalPassRate / results.length : 0,
        studentsAtRisk: totalStudentsAtRisk,
        totalExams,
        averageScore: results.length > 0 ? totalAverage / results.length : 0,
      });
    } catch (e) {
      // Silent fail — keep default values
    } finally {
      setLoading(false);
    }
  }

  const maxAverage = Math.max(...performances.map(p => p.average), 20);

  return (
    <ModuleContainer
      header={{
        title: 'Analytique & Intelligence ORION',
        description: 'Analyse prédictive et suivi des performances académiques.',
        icon: 'barChart3',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'analytics'
      }}
      content={{
        layout: 'full',
        children: loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Chargement des analytics...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bilingual track selector */}

            {/* Orion Insights — générés à partir des données réelles */}
            {insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.slice(0, 4).map((insight, idx) => (
                  <Card
                    key={idx}
                    className={`border-l-4 shadow-sm overflow-hidden ${
                      insight.type === 'ALERT'
                        ? 'border-l-amber-500 bg-amber-50/30'
                        : 'border-l-blue-500 bg-blue-50/30'
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className={`flex items-center space-x-2 ${insight.type === 'ALERT' ? 'text-amber-700' : 'text-blue-700'}`}>
                        {insight.type === 'ALERT' ? (
                          <Zap className="w-5 h-5 fill-amber-500" />
                        ) : (
                          <Target className="w-5 h-5 fill-blue-500" />
                        )}
                        <CardTitle className="text-sm font-black uppercase tracking-wider">{insight.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-900 font-medium">{insight.message}</p>
                      <Badge className={`mt-4 border-none ${insight.type === 'ALERT' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>
                        {insight.badge}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="shadow-sm border-gray-200">
                <CardContent className="py-8 text-center text-gray-500">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">Aucune insight ORION disponible</p>
                  <p className="text-xs mt-1">Les insights apparaîtront automatiquement quand des données d'évaluation seront disponibles.</p>
                </CardContent>
              </Card>
            )}

            {/* Performance Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-gray-100">
                <CardHeader>
                  <CardTitle className="text-md flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                    Moyenne par niveau scolaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-end space-x-8 px-8">
                  {performances.length > 0 ? (
                    performances.map((p) => (
                      <div key={p.levelCode} className="flex-1 flex flex-col items-center space-y-2">
                        <div
                          className="w-full bg-blue-100 rounded-t-lg relative group cursor-pointer hover:bg-blue-600 transition-all"
                          style={{ height: `${Math.max((p.average / maxAverage) * 80, 5)}%` }}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-1 rounded">
                            {p.average.toFixed(2)}/20
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-500">{p.levelLabel}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                      Aucune donnée de performance disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="shadow-sm border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500 uppercase">Taux de Réussite Global</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-gray-900">{globalStats.passRate.toFixed(1)}%</div>
                    <Progress value={globalStats.passRate} className="h-2 mt-4 bg-gray-100" />
                    <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase">
                      <span>Cible: 80%</span>
                      <span className={globalStats.passRate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                        {globalStats.passRate >= 80 ? 'Objectif atteint' : 'En dessous de l\'objectif'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500 uppercase">Élèves à Risque</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-red-600">{globalStats.studentsAtRisk}</div>
                    <p className="text-xs text-gray-500 mt-1">Moyenne générale &lt; 08/20</p>
                    <Button variant="link" className="p-0 h-auto text-blue-600 text-xs mt-4">Voir la liste détaillée</Button>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500 uppercase">Moyenne Globale</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-blue-700">{globalStats.averageScore.toFixed(2)}/20</div>
                    <p className="text-xs text-gray-500 mt-1">{globalStats.totalExams} évaluation(s) au total</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )
      }}
    />
  );
}
