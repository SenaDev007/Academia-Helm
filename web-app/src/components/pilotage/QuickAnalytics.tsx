/**
 * ============================================================================
 * QUICK ANALYTICS - ANALYSES RAPIDES
 * ============================================================================
 * 
 * Graphiques et comparatifs rapides
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface QuickAnalyticsProps {
  academicYearId: string;
  schoolLevelId: string;
}

export default function QuickAnalytics({ academicYearId, schoolLevelId }: QuickAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/general/weighted-average?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}`
        );
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [academicYearId, schoolLevelId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Évolution */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">Évolution</h3>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Graphique d'évolution (à implémenter)
        </div>
      </div>

      {/* Comparatif FR / EN */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">Comparatif FR / EN</h3>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Comparatif bilingue (à implémenter)
        </div>
      </div>
    </div>
  );
}

