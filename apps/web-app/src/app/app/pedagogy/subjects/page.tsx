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
        // Charger les niveaux actifs en parallèle
        const [subjectsRes, seriesRes, levelsRes] = await Promise.all([
          fetch(`/api/subjects?academicYearId=${academicYear.id}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/pedagogy/academic-series?academicYearId=${academicYear.id}`, { credentials: 'include', cache: 'no-store' }),
          fetch('/api/school-levels', { credentials: 'include', cache: 'no-store' }),
        ]);

        const subjects = subjectsRes.ok ? await subjectsRes.json() : [];
        const series = seriesRes.ok ? await seriesRes.json() : [];
        const activeLevels = levelsRes.ok ? await levelsRes.json() : [];

        // Noms des niveaux actifs en uppercase pour le filtrage
        const activeLevelNames = (Array.isArray(activeLevels) ? activeLevels : []).map(
          (l: any) => (l.code || l.label || '').toUpperCase(),
        );

        // Vérifier si le secondaire est actif (les séries ne concernent que le secondaire)
        const secondaryActive = activeLevelNames.some((n: string) => n.includes('SECONDAIRE'));

        // Filtrer les matières par niveaux actifs
        const isLevelActive = (levelName: string | undefined | null) => {
          if (!levelName) return true;
          if (activeLevelNames.length === 0) return true;
          const name = levelName.toUpperCase();
          return activeLevelNames.some((a: string) => name.includes(a) || a.includes(name));
        };

        const filteredSubjects = (Array.isArray(subjects) ? subjects : []).filter((s: any) =>
          isLevelActive(s.schoolLevel?.name || s.schoolLevel?.label || s.schoolLevel?.code),
        );
        const subjectsCount = filteredSubjects.length;

        // Les séries ne sont comptées que si le secondaire est actif
        const seriesCount = secondaryActive ? (Array.isArray(series) ? series.length : 0) : 0;

        // Programmes : compter les matières qui ont un programme officiel
        const programsCount = filteredSubjects.filter(
          (s: any) => s.subjectPrograms && s.subjectPrograms.length > 0,
        ).length;
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
