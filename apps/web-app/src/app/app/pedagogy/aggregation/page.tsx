'use client';

import { useState, useEffect } from 'react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Loader2, BarChart3, Layers, Users, BookOpen, CalendarDays } from 'lucide-react';
import { AggregationPageShell } from '@/components/aggregation/AggregationPageShell';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

interface LevelPedagogyStats {
  levelId: string;
  levelCode: string;
  levelLabel: string;
  totalClasses: number;
  totalTeachers: number;
  totalSubjects: number;
  totalTimetableSlots: number;
}

export default function PedagogyAggregationPage() {
  const { academicYear, tenant } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const [stats, setStats] = useState<LevelPedagogyStats[]>([]);
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
      const results: LevelPedagogyStats[] = [];

      for (const level of realLevels) {
        try {
          const params = new URLSearchParams({
            tenantId: tenant!.id,
            academicYearId: academicYear!.id,
            schoolLevelId: level.id,
          });
          // Utiliser l'endpoint KPI pédagogie qui retourne les stats par niveau
          const res = await fetch(`/api/pedagogy/kpi?${params.toString()}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalClasses: data?.totalClasses ?? data?.classesCount ?? 0,
              totalTeachers: data?.totalTeachers ?? data?.teachersCount ?? 0,
              totalSubjects: data?.totalSubjects ?? data?.subjectsCount ?? 0,
              totalTimetableSlots: data?.totalTimetableSlots ?? data?.timetableEntries ?? 0,
            });
          } else {
            // Fallback : essayer l'endpoint classes
            const classRes = await fetch(`/api/classes?${params.toString()}`, { credentials: 'include' });
            const classData = classRes.ok ? await classRes.json() : { data: [] };
            const classes = Array.isArray(classData) ? classData : (classData?.data ?? []);
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalClasses: classes.length,
              totalTeachers: 0,
              totalSubjects: 0,
              totalTimetableSlots: 0,
            });
          }
        } catch {
          results.push({ levelId: level.id, levelCode: level.code, levelLabel: LEVEL_LABELS[level.code] || level.label || level.code, totalClasses: 0, totalTeachers: 0, totalSubjects: 0, totalTimetableSlots: 0 });
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
      totalClasses: acc.totalClasses + s.totalClasses,
      totalTeachers: acc.totalTeachers + s.totalTeachers,
      totalSubjects: acc.totalSubjects + s.totalSubjects,
      totalTimetableSlots: acc.totalTimetableSlots + s.totalTimetableSlots,
    }),
    { totalClasses: 0, totalTeachers: 0, totalSubjects: 0, totalTimetableSlots: 0 },
  );

  // The aggregation page content (rendered INSIDE the parent module's tab bar)
  const content = loading ? (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      <span className="ml-2 text-gray-600">Chargement du bilan global...</span>
    </div>
  ) : (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agrégation & Bilan Global Pédagogie</h1>
          <p className="text-sm text-gray-500">
            Structure pédagogique de tous les niveaux confondus — {academicYear?.name || 'Année courante'}
          </p>
        </div>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">⚠ {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Total Classes</p><Layers className="w-5 h-5 text-blue-600" /></div><p className="text-2xl font-black text-gray-900">{totals.totalClasses}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Total Enseignants</p><Users className="w-5 h-5 text-emerald-600" /></div><p className="text-2xl font-black text-emerald-700">{totals.totalTeachers}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Total Matières</p><BookOpen className="w-5 h-5 text-amber-600" /></div><p className="text-2xl font-black text-amber-700">{totals.totalSubjects}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Créneaux EDT</p><CalendarDays className="w-5 h-5 text-violet-600" /></div><p className="text-2xl font-black text-violet-700">{totals.totalTimetableSlots}</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 p-6 border-b border-slate-100">Répartition par niveau scolaire</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Niveau</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Classes</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Enseignants</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Matières</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Créneaux EDT</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.levelId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.levelLabel}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{s.totalClasses}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-medium">{s.totalTeachers}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-700 font-medium">{s.totalSubjects}</td>
                  <td className="px-6 py-4 text-sm text-right text-violet-700 font-medium">{s.totalTimetableSlots}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-6 py-4 text-sm font-black text-blue-900">TOTAL TOUS NIVEAUX</td>
                <td className="px-6 py-4 text-sm text-right font-black text-gray-900">{totals.totalClasses}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-emerald-700">{totals.totalTeachers}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-amber-700">{totals.totalSubjects}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-violet-700">{totals.totalTimetableSlots}</td>
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
      moduleTitle="Organisation Pédagogique & Études"
      moduleDescription="Vue consolidée : complétion, affectations, structure, workflow documents et veille ORION"
      moduleIcon="bookOpen"
      tabs={getVisiblePedagogyTabs(userRole)}
      activeTabId="aggregation"
    >
      {content}
    </AggregationPageShell>
  );
}
