/**
 * ============================================================================
 * QUICK ANALYTICS - ANALYSES RAPIDES
 * ============================================================================
 *
 * Graphiques d'évolution et comparatif bilingue FR/EN.
 * Utilise /api/general/weighted-average avec rendu SVG léger.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface QuickAnalyticsProps {
  academicYearId: string;
  schoolLevelId: string;
}

interface EvolutionPoint {
  period: string;
  value: number;
}

interface BilingualData {
  french: number;
  english: number;
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

  const evolution: EvolutionPoint[] = analytics?.evolution || [
    { period: 'T1', value: 0 },
    { period: 'T2', value: 0 },
    { period: 'T3', value: 0 },
  ];

  const bilingual: BilingualData = analytics?.bilingualComparison || {
    french: 0,
    english: 0,
  };

  const maxEvoValue = Math.max(...evolution.map(e => e.value), 1);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Évolution */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#1A2BA6]" />
            <h3 className="text-lg font-semibold text-gray-900">Évolution</h3>
          </div>
          {analytics?.weightedAverage && (
            <span className="text-sm font-bold text-[#1A2BA6]">
              Moyenne : {analytics.weightedAverage.toFixed(1)}/20
            </span>
          )}
        </div>

        {/* SVG Line Chart */}
        <div className="h-64 relative">
          {evolution.every(e => e.value === 0) ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune donnée disponible</p>
                <p className="text-xs text-gray-300 mt-1">Les données apparaîtront après la première période</p>
              </div>
            </div>
          ) : (
            <svg viewBox="0 0 320 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="40"
                  y1={10 + i * 45}
                  x2="310"
                  y2={10 + i * 45}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              ))}

              {/* Y-axis labels */}
              {[20, 15, 10, 5, 0].map((val, i) => (
                <text
                  key={val}
                  x="35"
                  y={14 + i * 45}
                  textAnchor="end"
                  className="text-[9px] fill-gray-400"
                >
                  {val}
                </text>
              ))}

              {/* Area fill */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A2BA6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#1A2BA6" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {evolution.length >= 2 && (
                <path
                  d={evolution.map((point, i) => {
                    const x = 55 + i * (250 / Math.max(evolution.length - 1, 1));
                    const y = 190 - (point.value / Math.max(maxEvoValue, 20)) * 180;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ') + ` L ${55 + (evolution.length - 1) * (250 / Math.max(evolution.length - 1, 1))} 190 L 55 190 Z`}
                  fill="url(#areaGradient)"
                />
              )}

              {/* Line */}
              {evolution.length >= 2 && (
                <path
                  d={evolution.map((point, i) => {
                    const x = 55 + i * (250 / Math.max(evolution.length - 1, 1));
                    const y = 190 - (point.value / Math.max(maxEvoValue, 20)) * 180;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#1A2BA6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Points and labels */}
              {evolution.map((point, i) => {
                const x = 55 + i * (250 / Math.max(evolution.length - 1, 1));
                const y = 190 - (point.value / Math.max(maxEvoValue, 20)) * 180;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="4.5" fill="#1A2BA6" stroke="white" strokeWidth="2" />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-gray-700"
                    >
                      {point.value > 0 ? point.value.toFixed(1) : '—'}
                    </text>
                    <text
                      x={x}
                      y={200}
                      textAnchor="middle"
                      className="text-[10px] fill-gray-500"
                    >
                      {point.period}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Comparatif FR / EN */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#1A2BA6]" />
            <h3 className="text-lg font-semibold text-gray-900">Comparatif FR / EN</h3>
          </div>
          {(bilingual.french > 0 || bilingual.english > 0) && (
            <span className="text-xs font-medium text-gray-400">
              Moyenne pondérée
            </span>
          )}
        </div>

        <div className="h-64 flex items-center justify-center">
          {bilingual.french === 0 && bilingual.english === 0 ? (
            <div className="text-center">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucune donnée bilingue disponible</p>
              <p className="text-xs text-gray-300 mt-1">Activez l&apos;option bilingue pour voir le comparatif</p>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-8">
              {/* French bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Français</span>
                  <span className="text-sm font-bold text-[#1A2BA6]">{bilingual.french.toFixed(1)}/20</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1A2BA6] to-[#3B4FD4] transition-all duration-700"
                    style={{ width: `${(bilingual.french / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* English bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">English</span>
                  <span className="text-sm font-bold text-emerald-600">{bilingual.english.toFixed(1)}/20</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${(bilingual.english / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* Delta */}
              {bilingual.french > 0 && bilingual.english > 0 && (
                <div className="text-center pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Écart : </span>
                  <span className={`text-sm font-bold ${
                    bilingual.french > bilingual.english ? 'text-[#1A2BA6]' :
                    bilingual.english > bilingual.french ? 'text-emerald-600' : 'text-gray-700'
                  }`}>
                    {bilingual.french > bilingual.english ? 'FR' : bilingual.english > bilingual.french ? 'EN' : 'Égal'}
                    {' +'}{Math.abs(bilingual.french - bilingual.english).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
