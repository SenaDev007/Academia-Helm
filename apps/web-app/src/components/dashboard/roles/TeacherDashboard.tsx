/**
 * ============================================================================
 * TEACHER DASHBOARD
 * ============================================================================
 *
 * Dashboard pour l'ENSEIGNANT / INSTITUTEUR (espace pédagogique personnel)
 *
 * Affiche les KPIs de l'enseignant pour l'année scolaire courante :
 * - Classes assignées
 * - Élèves total
 * - Cours aujourd'hui
 * - Devoirs à corriger
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useTenantContext } from '@/contexts/TenantContext';
import { Users, BookOpen, CalendarCheck, FileQuestion, Loader2 } from 'lucide-react';

interface TeacherKpi {
  classesCount: number;
  studentsCount: number;
  lessonsToday: number;
  pendingGrades: number;
}

export function TeacherDashboard() {
  const { context } = useTenantContext();
  const [kpi, setKpi] = useState<TeacherKpi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!context?.tenant?.id || !context?.academicYear?.id) return;
    fetchTeacherKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.tenant?.id, context?.academicYear?.id]);

  async function fetchTeacherKpi() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        tenantId: context!.tenant!.id,
        academicYearId: context!.academicYear!.id,
      });
      // Note: endpoint peut ne pas exister encore — fallback sur données vides
      const res = await fetch(`/api/teacher/dashboard?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setKpi(data);
      } else {
        // Fallback : données vides si l'endpoint n'existe pas encore
        setKpi({ classesCount: 0, studentsCount: 0, lessonsToday: 0, pendingGrades: 0 });
      }
    } catch {
      setKpi({ classesCount: 0, studentsCount: 0, lessonsToday: 0, pendingGrades: 0 });
    } finally {
      setLoading(false);
    }
  }

  if (!context) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tableau de bord Enseignant</h1>
        <p className="text-gray-600 mt-2">
          {context.tenant.school?.name || context.tenant.name}
          {context.academicYear && ` - ${context.academicYear.name}`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Classes assignées</p>
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi?.classesCount ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Élèves total</p>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi?.studentsCount ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Cours aujourd'hui</p>
                <CalendarCheck className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi?.lessonsToday ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Devoirs à corriger</p>
                <FileQuestion className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi?.pendingGrades ?? 0}</p>
            </div>
          </div>

          {/* Actions Rapides */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Fiches Pédagogiques</h3>
              <p className="text-gray-600">Gérer les fiches pédagogiques</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Cahier Journal</h3>
              <p className="text-gray-600">Consulter le cahier journal</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Cahier de Textes</h3>
              <p className="text-gray-600">Gérer le cahier de textes</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

