/**
 * ============================================================================
 * MODULE GÉNÉRAL - VUE CONSOLIDÉE (LECTURE SEULE)
 * ============================================================================
 * 
 * Wireframe :
 * [ Vue consolidée – Tous niveaux ]
 * 
 * ┌───────────┬───────────┬───────────┐
 * │ Maternelle│ Primaire  │ Secondaire│
 * └───────────┴───────────┴───────────┘
 * 
 * [ Agrégations globales ]
 * - Effectif total
 * - Recettes totales
 * - Moyenne globale (pondérée)
 * 
 * ⚠️ Données issues d'agrégations contrôlées
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { formatCurrency } from '@/lib/utils';
import ModulePageLayout from './ModulePageLayout';

interface LevelAggregation {
  levelId: string;
  levelName: string;
  value: number;
}

interface ConsolidatedData {
  enrollment: {
    total: number;
    byLevel: LevelAggregation[];
    metadata: {
      calculationDate: string;
      calculationMethod: string;
    };
  };
  revenue: {
    total: number;
    byLevel: LevelAggregation[];
  };
  weightedAverage: {
    weightedAverage: number;
    byLevel: Array<LevelAggregation & { studentCount: number; average: number }>;
  };
}

export default function GeneralModulePage() {
  const { currentYear } = useAcademicYear();
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConsolidatedData = async () => {
      if (!currentYear) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/general/consolidated-report?academicYearId=${currentYear.id}`
        );
        if (response.ok) {
          const responseData = await response.json();
          setData(responseData);
        }
      } catch (error) {
        console.error('Failed to load consolidated data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConsolidatedData();
  }, [currentYear]);

  const getLevelLabel = (levelName: string) => {
    if (levelName.toLowerCase().includes('maternelle')) return 'Maternelle';
    if (levelName.toLowerCase().includes('primaire')) return 'Primaire';
    if (levelName.toLowerCase().includes('secondaire')) return 'Secondaire';
    return levelName;
  };

  return (
    <ModulePageLayout
      title="Module Général"
      subtitle="Vue consolidée – Tous niveaux"
      badge={
        <span className="px-3 py-1 bg-soft-gold/20 text-soft-gold text-xs font-medium rounded-full border border-soft-gold/30">
          Lecture seule
        </span>
      }
    >
      <div className="space-y-6">
        {/* Avertissement */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 mb-1">
                Vue consolidée - Agrégations contrôlées
              </p>
              <p className="text-sm text-yellow-800">
                Les données affichées sont issues d'agrégations explicites niveau par niveau.
                Toutes les valeurs sont traçables et reproductibles.
              </p>
            </div>
          </div>
        </div>

        {/* Effectif par niveau */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">Effectif total</h3>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {data?.enrollment.byLevel.map((level) => (
                  <div
                    key={level.levelId}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <p className="text-sm text-gray-600 mb-2">{getLevelLabel(level.levelName)}</p>
                    <p className="text-3xl font-bold text-navy-900">{level.value}</p>
                    <p className="text-xs text-gray-500 mt-1">élèves</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-navy-900">
                    {data?.enrollment.total || 0}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Recettes par niveau */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-6">
            <DollarSign className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">Recettes totales</h3>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {data?.revenue.byLevel.map((level) => (
                  <div
                    key={level.levelId}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <p className="text-sm text-gray-600 mb-2">{getLevelLabel(level.levelName)}</p>
                    <p className="text-2xl font-bold text-navy-900">
                      {formatCurrency(level.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-navy-900">
                    {formatCurrency(data?.revenue.total || 0)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Moyenne globale pondérée */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">Moyenne globale pondérée</h3>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {data?.weightedAverage.byLevel.map((level) => (
                  <div
                    key={level.levelId}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <p className="text-sm text-gray-600 mb-2">{getLevelLabel(level.levelName)}</p>
                    <p className="text-3xl font-bold text-navy-900">
                      {level.average.toFixed(2)}/20
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {level.studentCount} élèves
                    </p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">Moyenne globale pondérée</p>
                  <p className="text-2xl font-bold text-navy-900">
                    {data?.weightedAverage.weightedAverage.toFixed(2) || '0.00'}/20
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Pondération par effectif - {currentYear?.name}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Métadonnées */}
        {data && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-600">
              Calcul effectué le{' '}
              {new Date(data.enrollment.metadata.calculationDate).toLocaleString('fr-FR')} •{' '}
              Méthode : {data.enrollment.metadata.calculationMethod}
            </p>
          </div>
        )}
      </div>
    </ModulePageLayout>
  );
}

