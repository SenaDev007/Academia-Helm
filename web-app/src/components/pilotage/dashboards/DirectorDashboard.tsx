/**
 * ============================================================================
 * DASHBOARD DIRECTION / PROMOTEUR
 * ============================================================================
 * 
 * Wireframe :
 * [ KPI Cards ]
 * ┌─────────┬─────────┬─────────┬─────────┐
 * │ Effectif│ Assiduit│ Recettes│ Alertes │
 * └─────────┴─────────┴─────────┴─────────┘
 * 
 * [ Analyses ]
 * ┌─────────────────────┬──────────────────┐
 * │ Évolution résultats │ FR vs EN         │
 * └─────────────────────┴──────────────────┘
 * 
 * [ ORION – Lecture direction ]
 * ┌────────────────────────────────────────┐
 * │ Résumé exécutif ORION                  │
 * │ • Risques détectés                     │
 * │ • Recommandations                      │
 * │ [Voir analyse complète]                │
 * └────────────────────────────────────────┘
 * ============================================================================
 */

'use client';

import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import KPICards from '../KPICards';
import QuickAnalytics from '../QuickAnalytics';
import OrionAlertsCard from '../OrionAlertsCard';

interface DirectorDashboardProps {
  tenantId: string;
}

export default function DirectorDashboard({ tenantId }: DirectorDashboardProps) {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();

  if (!currentYear || !currentLevel) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de pilotage
        </h1>
        <p className="text-gray-600">
          {currentYear.name} • {currentLevel.code === 'MATERNELLE' ? 'Maternelle' :
                                 currentLevel.code === 'PRIMAIRE' ? 'Primaire' :
                                 currentLevel.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel.code}
        </p>
      </div>

      {/* KPI Cards */}
      <KPICards data={null} isLoading={false} />

      {/* Analyses */}
      <QuickAnalytics
        academicYearId={currentYear.id}
        schoolLevelId={currentLevel.id}
      />

      {/* ORION – Lecture direction */}
      <OrionAlertsCard
        academicYearId={currentYear.id}
        schoolLevelId={currentLevel.id}
      />
    </div>
  );
}

