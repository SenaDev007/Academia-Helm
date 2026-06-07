/**
 * ORION Summary Component
 * 
 * Composant pour afficher le résumé mensuel ORION
 */

'use client';

import type { OrionMonthlySummary } from '@/types';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';

interface OrionSummaryProps {
  summary: OrionMonthlySummary;
}

export default function OrionSummary({ summary }: OrionSummaryProps) {
  const getAlertLevelConfig = (level: string) => {
    switch (level) {
      case 'CRITIQUE':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'ATTENTION':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
        };
      case 'INFO':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
        };
      default:
        return {
          icon: Info,
          bgColor: 'bg-cloud',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-900 text-white rounded-lg p-4">
        <p className="text-sm font-semibold mb-1">Période</p>
        <p className="text-lg">{summary.period}</p>
      </div>

      {/* Faits */}
      <div>
        <h3 className="text-sm font-semibold text-blue-900 mb-3 uppercase tracking-wide">
          Faits Observés
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-cloud rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-graphite-500 mb-1">Financier</p>
            <p className="text-sm text-graphite-700">
              Recettes: {summary.facts.financial.totalRevenue.toLocaleString()} {summary.kpiData.currency}
            </p>
            <p className="text-sm text-graphite-700">
              Taux recouvrement: {summary.facts.financial.recoveryRate}%
            </p>
          </div>
          <div className="bg-cloud rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-graphite-500 mb-1">Académique</p>
            <p className="text-sm text-graphite-700">
              Élèves: {summary.facts.academic.totalStudents}
            </p>
            <p className="text-sm text-graphite-700">
              Classes: {summary.facts.academic.totalClasses}
            </p>
          </div>
          <div className="bg-cloud rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-graphite-500 mb-1">Opérationnel</p>
            <p className="text-sm text-graphite-700">
              Enseignants: {summary.facts.operational.totalTeachers}
            </p>
            <p className="text-sm text-graphite-700">
              Présence: {summary.facts.operational.teacherPresenceRate}%
            </p>
          </div>
        </div>
      </div>

      {/* Interprétation */}
      <div>
        <h3 className="text-sm font-semibold text-blue-900 mb-3 uppercase tracking-wide">
          Interprétation
        </h3>
        <div className="bg-cloud rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-graphite-700 mb-4 leading-relaxed">
            {summary.interpretation.overview}
          </p>

          {summary.interpretation.trends.length > 0 && (
            <div className="space-y-3">
              {summary.interpretation.trends.map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                  <div className="flex items-center space-x-3">
                    {trend.direction === 'UP' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : trend.direction === 'DOWN' ? (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    ) : (
                      <Minus className="w-5 h-5 text-graphite-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-blue-900">{trend.metric}</p>
                      <p className="text-xs text-graphite-700">{trend.description}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    trend.direction === 'UP' ? 'text-green-600' :
                    trend.direction === 'DOWN' ? 'text-red-600' :
                    'text-graphite-700'
                  }`}>
                    {trend.direction === 'UP' ? '+' : ''}{trend.magnitude}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {summary.interpretation.highlights.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                Points Clés
              </p>
              <ul className="space-y-2">
                {summary.interpretation.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm text-graphite-700">
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full mt-2 flex-shrink-0" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Vigilance */}
      {summary.vigilance.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-900 mb-3 uppercase tracking-wide">
            Points de Vigilance
          </h3>
          <div className="space-y-3">
            {summary.vigilance.map((alert) => {
              const config = getAlertLevelConfig(alert.level);
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className={`rounded-lg p-4 border-2 ${config.bgColor} ${config.borderColor}`}
                >
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`font-semibold ${config.textColor}`}>
                          {alert.title}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded ${config.borderColor} ${config.textColor} bg-white`}>
                          {alert.level}
                        </span>
                      </div>
                      <p className={`text-sm ${config.textColor} mb-3`}>
                        {alert.interpretation}
                      </p>
                      <p className={`text-sm font-medium ${config.textColor}`}>
                        {alert.vigilance}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

