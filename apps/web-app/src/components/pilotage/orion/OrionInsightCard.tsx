/**
 * ============================================================================
 * ORION INSIGHT CARD - CARTE DÉDIÉE SUR LE DASHBOARD
 * ============================================================================
 * 
 * Carte discrète pour afficher les insights ORION
 * Non envahissante, résumé court (5-6 lignes)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Brain, ChevronRight, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import Link from 'next/link';

interface OrionInsight {
  id: string;
  title: string;
  summary: string;
  type: 'RISK' | 'OPPORTUNITY' | 'RECOMMENDATION';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface OrionInsightCardProps {
  academicYearId: string;
  schoolLevelId: string;
  limit?: number;
}

export default function OrionInsightCard({
  academicYearId,
  schoolLevelId,
  limit = 3,
}: OrionInsightCardProps) {
  const [insights, setInsights] = useState<OrionInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/orion/insights?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}&limit=${limit}`
        );
        if (response.ok) {
          const data = await response.json();
          setInsights(data);
        }
      } catch (error) {
        console.error('Failed to load ORION insights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();
    const interval = setInterval(loadInsights, 300000); // Toutes les 5 minutes
    return () => clearInterval(interval);
  }, [academicYearId, schoolLevelId, limit]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-3 bg-gray-200 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
    );
  }

  if (insights.length === 0) {
    return null; // Ne rien afficher s'il n'y a pas d'insights
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'RISK':
        return AlertTriangle;
      case 'OPPORTUNITY':
        return TrendingUp;
      case 'RECOMMENDATION':
        return Lightbulb;
      default:
        return Brain;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'RISK':
        return 'text-red-600 bg-red-50';
      case 'OPPORTUNITY':
        return 'text-green-600 bg-green-50';
      case 'RECOMMENDATION':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-navy-900" />
          <h3 className="text-lg font-semibold text-navy-900">Analyse ORION</h3>
        </div>
        <Link
          href="/app/orion"
          className="text-sm text-navy-600 hover:text-navy-900 font-medium flex items-center space-x-1"
        >
          <span>Voir l'analyse complète</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {insights.slice(0, limit).map((insight) => {
          const Icon = getTypeIcon(insight.type);
          return (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border ${getTypeColor(insight.type)}`}
            >
              <div className="flex items-start space-x-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{insight.title}</h4>
                  <p className="text-sm opacity-90">{insight.summary}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

