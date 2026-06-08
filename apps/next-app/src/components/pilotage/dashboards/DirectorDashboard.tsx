/**
 * ============================================================================
 * DASHBOARD DIRECTION / PROMOTEUR
 * ============================================================================
 *
 * Dashboard de direction avec fetch réel des KPI depuis le backend.
 * Utilise /api/general/consolidated-report avec fallback multi-sources.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
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
  const [kpiData, setKpiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadKPIData = async () => {
      if (!currentYear || !currentLevel) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (currentYear?.id) params.set('academicYearId', currentYear.id);
        if (currentLevel?.id) params.set('schoolLevelId', currentLevel.id);

        const response = await fetch(`/api/general/consolidated-report?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setKpiData(data);
        } else {
          console.warn('Failed to load KPI data:', response.status);
          setKpiData(null);
        }
      } catch (error) {
        console.error('Failed to load KPI data:', error);
        setKpiData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadKPIData();
  }, [currentYear, currentLevel, tenantId]);

  if (!currentYear || !currentLevel) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Sélectionnez une année scolaire et un niveau</p>
        </div>
      </div>
    );
  }

  const levelLabel =
    currentLevel.code === 'MATERNELLE' ? 'Maternelle' :
    currentLevel.code === 'PRIMAIRE' ? 'Primaire' :
    currentLevel.code === 'SECONDAIRE' ? 'Secondaire' :
    currentLevel.code === 'ALL' ? 'Tous les niveaux' : currentLevel.code;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de pilotage
        </h1>
        <p className="text-gray-600">
          {currentYear.name} • {levelLabel}
        </p>
      </div>

      {/* KPI Cards - with real data */}
      <KPICards data={kpiData} isLoading={isLoading} />

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
