/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATIÈRES & PROGRAMMES
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  ModuleContainer,
} from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import SubjectsWorkspace from '@/components/pedagogy/subjects/SubjectsWorkspace';

export default function SubjectsPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const { academicYear } = useModuleContext();

  // KPIs dynamiques alimentés par la base de données
  const [kpis, setKpis] = useState([
    { label: 'Matières', value: '—', trend: '', trendType: 'neutral' as const },
    { label: 'Séries', value: '—', trend: '', trendType: 'neutral' as const },
    { label: 'Programmes', value: '—', trend: '', trendType: 'neutral' as const },
  ]);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;

    (async () => {
      try {
        // Charger les matières
        const subjectsRes = await fetch(
          `/api/subjects?academicYearId=${academicYear.id}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const subjects = subjectsRes.ok ? await subjectsRes.json() : [];
        const subjectsCount = Array.isArray(subjects) ? subjects.length : 0;

        // Charger les séries
        const seriesRes = await fetch(
          `/api/pedagogy/academic-series?academicYearId=${academicYear.id}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const series = seriesRes.ok ? await seriesRes.json() : [];
        const seriesCount = Array.isArray(series) ? series.length : 0;

        // Programmes : compter les matières qui ont un programme officiel
        // (subjectPrograms est inclus dans la réponse subjects si présent)
        const programsCount = Array.isArray(subjects)
          ? subjects.filter((s: any) => s.subjectPrograms && s.subjectPrograms.length > 0).length
          : 0;
        const programsPct = subjectsCount > 0
          ? Math.round((programsCount / subjectsCount) * 100)
          : 0;

        if (!cancelled) {
          setKpis([
            { label: 'Matières', value: String(subjectsCount), trend: '', trendType: 'neutral' as const },
            { label: 'Séries', value: String(seriesCount), trend: '', trendType: 'neutral' as const },
            { label: 'Programmes', value: `${programsPct}%`, trend: '', trendType: 'neutral' as const },
          ]);
        }
      } catch (e) {
        // Garder les valeurs '—' en cas d'erreur
      }
    })();

    return () => { cancelled = true; };
  }, [academicYear?.id]);

  return (
    <ModuleContainer
      header={{
        title: 'Matières & Programmes',
        description: 'Définition institutionnelle du catalogue pédagogique, des séries et des programmes officiels.',
        icon: 'bookOpen',
        kpis,
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
        activeModuleId: 'subjects',
      }}
      content={{
        layout: 'custom',
        children: <SubjectsWorkspace />,
      }}
    />
  );
}
