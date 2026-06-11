/**
 * ============================================================================
 * ORION FULL PAGE - PAGE ORION COMPLÈTE (LECTURE SEULE)
 * ============================================================================
 * 
 * Page complète pour l'analyse ORION
 * Résumé exécutif, données chiffrées, recommandations neutres
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, BarChart3 } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from '../modules/ModulePageLayout';

interface OrionAnalysis {
  summary: {
    risks: number;
    opportunities: number;
    recommendations: number;
  };
  risks: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    impact: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    potential: string;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  kpis: {
    averageScore: number;
    attendanceRate: number;
    revenueGrowth: number;
  };
}

export default function OrionFullPage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [analysis, setAnalysis] = useState<OrionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!currentYear || !currentLevel) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/orion/analysis?academicYearId=${currentYear.id}&schoolLevelId=${currentLevel.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setAnalysis(data);
        }
      } catch (error) {
        console.error('Failed to load ORION analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysis();
  }, [currentYear, currentLevel]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <ModulePageLayout
      title="Analyse ORION"
      subtitle="Intelligence décisionnelle - Lecture seule"
      badge={
        <span className="px-3 py-1 bg-yellow-50 text-yellow-800 text-xs font-medium rounded-full border border-yellow-200">
          IA Décisionnelle
        </span>
      }
    >
      <div className="space-y-6">
        {/* Résumé exécutif */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Brain className="w-6 h-6 text-navy-900" />
            <h3 className="text-xl font-semibold text-navy-900">Résumé exécutif</h3>
          </div>
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Chargement de l'analyse...</div>
          ) : analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h4 className="font-semibold text-red-900">Risques détectés</h4>
                </div>
                <p className="text-3xl font-bold text-red-900">{analysis.summary.risks}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">Opportunités</h4>
                </div>
                <p className="text-3xl font-bold text-green-900">{analysis.summary.opportunities}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">Recommandations</h4>
                </div>
                <p className="text-3xl font-bold text-blue-900">{analysis.summary.recommendations}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">Aucune analyse disponible</div>
          )}
        </div>

        {/* KPI */}
        {analysis && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className="w-5 h-5 text-navy-900" />
              <h3 className="text-lg font-semibold text-navy-900">Indicateurs clés</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Moyenne générale</p>
                <p className="text-2xl font-bold text-navy-900">
                  {analysis.kpis.averageScore.toFixed(2)}/20
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Taux d'assiduité</p>
                <p className="text-2xl font-bold text-navy-900">
                  {analysis.kpis.attendanceRate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Croissance des recettes</p>
                <p className="text-2xl font-bold text-navy-900">
                  {analysis.kpis.revenueGrowth > 0 ? '+' : ''}
                  {analysis.kpis.revenueGrowth.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Risques */}
        {analysis && analysis.risks.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-navy-900">Risques détectés</h3>
            </div>
            <div className="space-y-4">
              {analysis.risks.map((risk) => (
                <div
                  key={risk.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(risk.severity)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{risk.title}</h4>
                    <span className="text-xs font-medium px-2 py-1 rounded">
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{risk.description}</p>
                  <p className="text-xs opacity-75">Impact : {risk.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunités */}
        {analysis && analysis.opportunities.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-navy-900">Opportunités</h3>
            </div>
            <div className="space-y-4">
              {analysis.opportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="p-4 rounded-lg border border-green-200 bg-green-50"
                >
                  <h4 className="font-semibold text-green-900 mb-2">{opportunity.title}</h4>
                  <p className="text-sm text-green-800 mb-2">{opportunity.description}</p>
                  <p className="text-xs text-green-700">Potentiel : {opportunity.potential}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommandations */}
        {analysis && analysis.recommendations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-navy-900">Recommandations</h3>
            </div>
            <div className="space-y-4">
              {analysis.recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="p-4 rounded-lg border border-blue-200 bg-blue-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-blue-900">{recommendation.title}</h4>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {recommendation.priority}
                    </span>
                  </div>
                  <p className="text-sm text-blue-800">{recommendation.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600">
            <strong>Note :</strong> ORION est un système d'aide à la décision en lecture seule.
            Aucune modification de données n'est effectuée par ORION. Toutes les analyses sont
            basées sur les données existantes et respectent l'isolation des niveaux scolaires.
          </p>
        </div>
      </div>
    </ModulePageLayout>
  );
}

