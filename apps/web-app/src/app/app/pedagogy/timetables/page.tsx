/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - EMPLOI DU TEMPS (EDT) — STE V2+
 * ============================================================================
 */
'use client';

import { useState, useEffect } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import TimetablesWorkspace from '@/components/pedagogy/timetables/TimetablesWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export default function TimetablesPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();

  const [kpis, setKpis] = useState([
    { label: 'Solutions', value: '—', trend: '', trendType: 'neutral' as const },
    { label: 'Score EDT actif', value: '—', trend: '', trendType: 'neutral' as const },
    { label: 'Conflits', value: '—', trend: '', trendType: 'neutral' as const },
  ]);

  useEffect(() => {
    if (!academicYear?.id || !currentLevel?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/timetable-engine/solutions?schoolLevelId=${currentLevel.id}&academicYearId=${academicYear.id}`,
          { headers: { ...getClientAuthorizationHeader() }, credentials: 'include', cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        const solutions = Array.isArray(data) ? data : [];
        const accepted = solutions.find((s: any) => s.status === 'ACCEPTED');
        const lastSol = solutions[0];
        const conflictCount = lastSol?.conflictCount ?? 0;

        if (!cancelled) {
          setKpis([
            { label: 'Solutions', value: String(solutions.length), trend: '', trendType: 'neutral' as const },
            {
              label: 'Score EDT actif',
              value: accepted ? `${accepted.score}%` : '—',
              trend: '',
              trendType: (accepted && accepted.score >= 80 ? 'up' : accepted && accepted.score >= 60 ? 'neutral' : 'down') as 'up' | 'neutral' | 'down',
            },
            {
              label: 'Conflits',
              value: String(conflictCount),
              trend: '',
              trendType: (conflictCount === 0 ? 'up' : 'down') as 'up' | 'down',
            },
          ]);
        }
      } catch (e) { /* Garder les valeurs '—' */ }
    })();

    return () => { cancelled = true; };
  }, [academicYear?.id, currentLevel?.id]);

  return (
    <ModuleContainer
      header={{
        title: 'Emploi du Temps (EDT)',
        description: academicYear
          ? `Smart Timetable Engine V2+ — multi-solutions Pareto, contraintes hard/soft, backtracking — année ${academicYear.label}`
          : 'Génération multi-solutions Pareto avec contraintes et backtracking',
        icon: 'calendar',
        kpis,
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
        activeModuleId: 'timetables',
      }}
      content={{ layout: 'custom', children: <TimetablesWorkspace /> }}
    />
  );
}
