/**
 * ============================================================================
 * PILOTAGE DASHBOARD - CŒUR DU SYSTÈME
 * ============================================================================
 * 
 * Dashboard de pilotage : En 30 secondes, le directeur comprend l'état de son école.
 * 
 * Philosophie :
 * - Montrer avant de demander
 * - Résumer avant de détailler
 * - Alerter avant qu'il ne soit trop tard
 * - Guider sans infantiliser
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertTriangle, DollarSign, BookOpen, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import OrionAlertsCard from './OrionAlertsCard';
import KPICards from './KPICards';
import QuickAnalytics from './QuickAnalytics';

interface PilotageDashboardProps {
  tenantId: string;
}

export default function PilotageDashboard({ tenantId }: PilotageDashboardProps) {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [kpiData, setKpiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadKPIData = async () => {
      if (!currentYear || !currentLevel) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/general/consolidated-report?academicYearId=${currentYear.id}&schoolLevelId=${currentLevel.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setKpiData(data);
        }
      } catch (error) {
        console.error('Failed to load KPI data:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de pilotage
        </h1>
        <p className="text-gray-600">
          {currentYear.name} • {currentLevel.code === 'MATERNELLE' ? 'Maternelle' :
                                 currentLevel.code === 'PRIMAIRE' ? 'Primaire' :
                                 currentLevel.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel.code}
        </p>
      </motion.div>

      {/* KPI Clés */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut', delay: 0.05 }}
      >
        <KPICards data={kpiData} isLoading={isLoading} />
      </motion.div>

      {/* Analyses Rapides */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut', delay: 0.1 }}
      >
        <QuickAnalytics
          academicYearId={currentYear.id}
          schoolLevelId={currentLevel.id}
        />
      </motion.div>

      {/* Alertes & Actions ORION */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut', delay: 0.15 }}
      >
        <OrionAlertsCard
          academicYearId={currentYear.id}
          schoolLevelId={currentLevel.id}
        />
      </motion.div>
    </div>
  );
}

