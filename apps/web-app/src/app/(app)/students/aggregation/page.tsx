'use client';

import { useState, useEffect } from 'react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { Loader2, BarChart3, Users, GraduationCap, UserPlus, UserCheck } from 'lucide-react';

const LEVEL_LABELS: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

interface LevelStudentStats {
  levelId: string;
  levelCode: string;
  levelLabel: string;
  totalStudents: number;
  newEnrollments: number;
  activeStudents: number;
  transferredOut: number;
}

export default function StudentsAggregationPage() {
  const { academicYear, tenant } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [stats, setStats] = useState<LevelStudentStats[]>([]);
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
      const results: LevelStudentStats[] = [];

      for (const level of realLevels) {
        try {
          const params = new URLSearchParams({
            tenantId: tenant!.id,
            academicYearId: academicYear!.id,
            schoolLevelId: level.id,
          });
          const res = await fetch(`/api/students?${params.toString()}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const students = Array.isArray(data) ? data : (data?.data ?? []);
            results.push({
              levelId: level.id,
              levelCode: level.code,
              levelLabel: LEVEL_LABELS[level.code] || level.label || level.code,
              totalStudents: students.length,
              newEnrollments: students.filter((s: any) => s.enrollmentType === 'NEW' || s.status === 'ADMITTED').length,
              activeStudents: students.filter((s: any) => s.status === 'ACTIVE' || s.status === 'RE_ENROLLED' || s.status === 'VALIDATED').length,
              transferredOut: students.filter((s: any) => s.status === 'TRANSFERRED' || s.enrollmentType === 'TRANSFER').length,
            });
          } else {
            results.push({ levelId: level.id, levelCode: level.code, levelLabel: LEVEL_LABELS[level.code] || level.label || level.code, totalStudents: 0, newEnrollments: 0, activeStudents: 0, transferredOut: 0 });
          }
        } catch {
          results.push({ levelId: level.id, levelCode: level.code, levelLabel: LEVEL_LABELS[level.code] || level.label || level.code, totalStudents: 0, newEnrollments: 0, activeStudents: 0, transferredOut: 0 });
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
      totalStudents: acc.totalStudents + s.totalStudents,
      newEnrollments: acc.newEnrollments + s.newEnrollments,
      activeStudents: acc.activeStudents + s.activeStudents,
      transferredOut: acc.transferredOut + s.transferredOut,
    }),
    { totalStudents: 0, newEnrollments: 0, activeStudents: 0, transferredOut: 0 },
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement du bilan global...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agrégation & Bilan Global Élèves</h1>
          <p className="text-sm text-gray-500">
            Effectifs de tous les niveaux scolaires confondus — {academicYear?.name || 'Année courante'}
          </p>
        </div>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">⚠ {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Total Élèves</p><Users className="w-5 h-5 text-blue-600" /></div><p className="text-2xl font-black text-gray-900">{totals.totalStudents}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Nouvelles Inscriptions</p><UserPlus className="w-5 h-5 text-emerald-600" /></div><p className="text-2xl font-black text-emerald-700">{totals.newEnrollments}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Élèves Actifs</p><UserCheck className="w-5 h-5 text-blue-600" /></div><p className="text-2xl font-black text-blue-700">{totals.activeStudents}</p></div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-2"><p className="text-sm text-gray-600">Transferts Sortants</p><GraduationCap className="w-5 h-5 text-amber-600" /></div><p className="text-2xl font-black text-amber-700">{totals.transferredOut}</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 p-6 border-b border-slate-100">Répartition par niveau scolaire</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Niveau</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Total Élèves</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Nouvelles Inscriptions</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Élèves Actifs</th>
                <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Transferts Sortants</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.levelId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.levelLabel}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{s.totalStudents}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-medium">{s.newEnrollments}</td>
                  <td className="px-6 py-4 text-sm text-right text-blue-700 font-medium">{s.activeStudents}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-700 font-medium">{s.transferredOut}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-6 py-4 text-sm font-black text-blue-900">TOTAL TOUS NIVEAUX</td>
                <td className="px-6 py-4 text-sm text-right font-black text-gray-900">{totals.totalStudents}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-emerald-700">{totals.newEnrollments}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-blue-700">{totals.activeStudents}</td>
                <td className="px-6 py-4 text-sm text-right font-black text-amber-700">{totals.transferredOut}</td>
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
}
