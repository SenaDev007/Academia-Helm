'use client';

import { useState, useEffect } from 'react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { Loader2, BarChart3, FileText, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { AggregationPageShell } from '@/components/aggregation/AggregationPageShell';
import { EXAMS_SUB_MODULES } from '../sub-modules';

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

interface LevelExamStats {
  levelId: string;
  levelCode: string;
  levelLabel: string;
  totalExams: number;
  gradesEntered: number;
  gradesValidated: number;
  bulletinsGenerated: number;
  averageScore: number;
  passRate: number;
}

export default function ExamsAggregationPage() {
  const { academicYear, tenant } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [stats, setStats] = useState<LevelExamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYear?.id || !tenant?.id) return;
    fetchAggregation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, tenant?.id]);

  async function fetchAggregation() {
    try {
      setLoading(true);
      setError(null);
      const realLevels = availableLevels.filter((l: any) => l.id !== 'ALL' && l.isActive);
      const results: LevelExamStats[] = [];

      for (const level of realLevels) {
        try {
          const params = new URLSearchParams({
            tenantId: tenant!.id,
            academicYearId: academicYear!.id,
            schoolLevelId: level.id,
          });
          const res = await fetch(`/api/exams/dashboard?${params.toString()}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalExams: data?.totalExams ?? data?.examsCount ?? 0,
              gradesEntered: data?.gradesEntered ?? data?.gradesCount ?? 0,
              gradesValidated: data?.gradesValidated ?? 0,
              bulletinsGenerated: data?.bulletinsGenerated ?? data?.bulletinsCount ?? 0,
              averageScore: data?.averageScore ?? data?.generalAverage ?? 0,
              passRate: data?.passRate ?? data?.successRate ?? 0,
            });
          } else {
            results.push({ levelId: level.id, levelCode: level.code, levelLabel: LEVEL_LABELS[level.code] || level.label || level.code, totalExams: 0, gradesEntered: 0, gradesValidated: 0, bulletinsGenerated: 0, averageScore: 0, passRate: 0 });
          }
        } catch {
          results.push({ levelId: level.id, levelCode: level.code, levelLabel: LEVEL_LABELS[level.code] || level.label || level.code, totalExams: 0, gradesEntered: 0, gradesValidated: 0, bulletinsGenerated: 0, averageScore: 0, passRate: 0 });
        }
      }
      setStats(results);
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  const totals = stats.reduce(
    (acc, s) => ({
      totalExams: acc.totalExams + s.totalExams,
      gradesEntered: acc.gradesEntered + s.gradesEntered,
      gradesValidated: acc.gradesValidated + s.gradesValidated,
      bulletinsGenerated: acc.bulletinsGenerated + s.bulletinsGenerated,
    }),
    { totalExams: 0, gradesEntered: 0, gradesValidated: 0, bulletinsGenerated: 0 },
  );
  const globalAverage = stats.length > 0 ? (stats.reduce((sum, s) => sum + s.averageScore, 0) / stats.length) : 0;
  const globalPassRate = stats.length > 0 ? (stats.reduce((sum, s) => sum + s.passRate, 0) / stats.length) : 0;


  const content = loading ? (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des statistiques globales...</span>
      </div>
  ) : (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agrégation & Statistiques Globales</h1>
          <p className="text-sm text-gray-500">
            Vue globale des examens et notes de tous les niveaux confondus — {academicYear?.name || 'Année courante'}
          </p>
        </div>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">⚠ {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Total Examens</p><FileText className="w-5 h-5 text-blue-600" /></div><p className="text-xl font-black text-gray-900">{totals.totalExams}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Notes Saisies</p><TrendingUp className="w-5 h-5 text-amber-600" /></div><p className="text-xl font-black text-amber-700">{totals.gradesEntered}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Notes Validées</p><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><p className="text-xl font-black text-emerald-700">{totals.gradesValidated}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Bulletins</p><FileText className="w-5 h-5 text-violet-600" /></div><p className="text-xl font-black text-violet-700">{totals.bulletinsGenerated}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Moyenne Globale</p><TrendingUp className="w-5 h-5 text-blue-600" /></div><p className="text-xl font-black text-blue-700">{globalAverage.toFixed(2)}/20</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Taux Réussite</p><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><p className="text-xl font-black text-emerald-700">{globalPassRate.toFixed(1)}%</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 p-6 border-b border-slate-100">Répartition par niveau scolaire</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Niveau</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Examens</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Notes Saisies</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Notes Validées</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Bulletins</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Moyenne</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Taux Réussite</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.levelId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.levelLabel}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{s.totalExams}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-700 font-medium">{s.gradesEntered}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-medium">{s.gradesValidated}</td>
                  <td className="px-6 py-4 text-sm text-right text-violet-700 font-medium">{s.bulletinsGenerated}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-blue-700">{s.averageScore.toFixed(2)}/20</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-emerald-700">{s.passRate.toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-6 py-4 text-sm font-black text-blue-900">TOTAL TOUS NIVEAUX</td>
                <td className="px-6 py-4 text-sm text-right font-black text-gray-900">{totals.totalExams}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-amber-700">{totals.gradesEntered}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-emerald-700">{totals.gradesValidated}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-violet-700">{totals.bulletinsGenerated}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-blue-700">{globalAverage.toFixed(2)}/20</td>
                <td className="px-6 py-4 text-sm text-right font-black text-emerald-700">{globalPassRate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-slate-200">
          Aucun niveau scolaire activé.
        </div>
      )}
    </div>
  );
  return (
    <AggregationPageShell
      moduleTitle='Examens & Notes'
      moduleDescription='Gestion des examens, évaluations, bulletins, moyennes et conseils de classe.'
      moduleIcon='fileText'
      tabs={EXAMS_SUB_MODULES}
      activeTabId='aggregation'
    >
      {content}
    </AggregationPageShell>
  );
}
