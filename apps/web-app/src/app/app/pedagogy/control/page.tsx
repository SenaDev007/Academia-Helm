'use client';

import { useState, useEffect, useCallback } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import {
  FileText,
  Users,
  Layers,
  Loader2,
  AlertCircle,
  BookOpen,
  ClipboardList,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface ControlDashboard {
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  overallRate: number;
  totalActiveAssignments: number;
  totalActiveProfiles: number;
  lastCalculatedAt: string | null;
  snapshotsCount: number;
}

export default function ControlPage() {
  const { academicYear } = useModuleContext();
  const [dashboard, setDashboard] = useState<ControlDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!academicYear?.id) {
      setDashboard(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/pedagogy/control/dashboard?academicYearId=${encodeURIComponent(academicYear.id)}`;
      const data = await pedagogyFetch<ControlDashboard>(url);
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const formatRate = (rate: number) => `${Math.round(rate * 100)} %`;

  return (
    <ModuleContainer
      header={{
        title: 'Contrôle pédagogique direction',
        description: 'Vue consolidée, KPI, rapports exportables',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!academicYear?.id ? (
              <p className="text-gray-500">
                Sélectionnez une année scolaire pour afficher le tableau de bord.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement…
              </div>
            ) : dashboard ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fiches / plans</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatRate(dashboard.lessonPlanRate)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-100 p-2">
                        <BookOpen className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Cahier journal</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatRate(dashboard.journalRate)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 p-2">
                        <ClipboardList className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Cahier de texte</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatRate(dashboard.classLogRate)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2">
                        <Calendar className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Semainier</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatRate(dashboard.weeklyReportRate)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                    <BarChart3 className="w-8 h-8 text-indigo-600" />
                    <div>
                      <p className="font-medium text-gray-900">Taux global</p>
                      <p className="text-2xl font-semibold text-indigo-600">
                        {formatRate(dashboard.overallRate)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                    <Users className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="font-medium text-gray-900">Enseignants actifs</p>
                      <p className="text-2xl font-semibold text-gray-700">
                        {dashboard.totalActiveProfiles}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                    <Layers className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Affectations actives</p>
                      <p className="text-2xl font-semibold text-gray-700">
                        {dashboard.totalActiveAssignments}
                      </p>
                    </div>
                  </div>
                </div>

                {dashboard.lastCalculatedAt && (
                  <p className="text-sm text-gray-500">
                    Dernier calcul KPI :{' '}
                    {new Date(dashboard.lastCalculatedAt).toLocaleString('fr-FR')}
                    {dashboard.snapshotsCount > 0 && ` (${dashboard.snapshotsCount} snapshot(s))`}
                  </p>
                )}
              </>
            ) : null}
          </div>
        ),
      }}
    />
  );
}
