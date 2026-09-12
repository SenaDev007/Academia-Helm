/**
 * ============================================================================
 * PILOTAGE DASHBOARD — TABLEAU DE BORD DE PILOTAGE COMPLET
 * ============================================================================
 *
 * Véritable tableau de bord de pilotage couvrant toute l'application :
 *  - KPIs transverses (élèves, finances, pédagogie, RH)
 *  - Graphiques d'évolution (recettes, effectifs, assiduité, moyennes)
 *  - Alertes & notifications
 *  - Accès rapide aux modules métiers
 *
 * Sources de données (toutes via React Query + BFF) :
 *  - /api/general/consolidated-report : KPIs effectifs/assiduité/recettes/alertes
 *  - /api/general/weighted-average : moyennes pondérées + évolution trimestrielle
 *  - /api/students/statistics : effectifs par classe/sexe/niveau
 *  - /api/finance/reports/kpi : KPIs financiers (recettes, impayés, trésorerie)
 *  - /api/finance/treasury/statistics : statistiques trésorerie
 *  - /api/hr (proxy) : effectifs personnel
 *  - /api/general/consolidated-report (alerts.items) : alertes actives
 *
 * Robustesse :
 *  - React Query avec staleTime 2 min, retry 1, refetchOnWindowFocus false
 *  - Timeout 15s via fetchWithTimeout dans les routes BFF
 *  - États loading / error / empty / success distincts (pas de spin infini)
 *  - Dégradation gracieuse : si une source échoue, on affiche des zéros
 *
 * ============================================================================
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Users, Wallet, GraduationCap, TrendingUp, AlertTriangle, Clock,
  ArrowRight, BookOpen, UserCog, MessageSquare, School, DollarSign,
  PieChart, BarChart3, FileText, Calendar, Activity, Award, Banknote,
  UserPlus, TrendingDown, ChevronRight, AlertCircle, CheckCircle2,
  UserCheck, UserX, Coins, Wallet2,
} from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
// ⭐ P4-final : dashboard de pilotage bilingue (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';
import KPICards from '@/components/pilotage/KPICards';
import OrionAlertsCard from '@/components/pilotage/OrionAlertsCard';

// ──────────────────────────────────────────────────────────────────────────
// Fetchers — wrappers simples avec cache: 'no-store' et timeout implicite via BFF
// ──────────────────────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Hook principal — données consolidées (KPIs globaux)
// ──────────────────────────────────────────────────────────────────────────

function useConsolidatedReport(academicYearId?: string, schoolLevelId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'consolidated-report', academicYearId, schoolLevelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      const url = `/api/general/consolidated-report${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchJson(url);
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook — moyennes pondérées + évolution trimestrielle
// ──────────────────────────────────────────────────────────────────────────

function useWeightedAverage(academicYearId?: string, schoolLevelId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'weighted-average', academicYearId, schoolLevelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      const url = `/api/general/weighted-average${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchJson(url);
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook — statistiques élèves (effectifs par classe/sexe)
// ──────────────────────────────────────────────────────────────────────────

function useStudentsStatistics(academicYearId?: string, schoolLevelId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'students-statistics', academicYearId, schoolLevelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      const url = `/api/students/statistics${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchJson(url);
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook — KPIs financiers
// ──────────────────────────────────────────────────────────────────────────

function useFinanceKpis(academicYearId?: string, schoolLevelId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'finance-kpis', academicYearId, schoolLevelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      const url = `/api/finance/reports/kpi${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchJson(url);
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook — recette du jour
// ──────────────────────────────────────────────────────────────────────────

function useTodayRevenue() {
  return useQuery({
    queryKey: ['dashboard', 'today-revenue'],
    queryFn: async () => {
      // ⭐ Appeler /api/finance/reports/today (backend NestJS)
      //    qui renvoie { total, count, expenses, net, date }
      const data = await fetchJson('/api/finance/payments/today');
      return data?.total ?? data?.amount ?? 0;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Utilitaires de formatage
// ──────────────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (!value || isNaN(value)) return '0 F CFA';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' F CFA';
}

function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatPercent(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

// ──────────────────────────────────────────────────────────────────────────
// Composant — Carte KPI secondaire (recette du jour, moyenne, etc.)
// ──────────────────────────────────────────────────────────────────────────

interface MiniKpiCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean } | null;
  loading?: boolean;
}

function MiniKpiCard({ label, value, icon: Icon, iconColor, iconBg, subtitle, trend, loading }: MiniKpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend.positive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
          }`}>
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-navy-900">
        {loading ? <span className="text-gray-300">—</span> : value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composant — Graphique en barres SVG (effectifs par classe)
// ──────────────────────────────────────────────────────────────────────────

interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

function BarChartCard({ title, data, icon: Icon, accentColor }: {
  title: string;
  data: BarChartDataPoint[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}) {
  const L = useL();
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const [showAll, setShowAll] = useState(false);
  const visibleData = showAll ? data : data.slice(0, 6);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {data.length > 6 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {showAll ? 'Voir moins' : `Voir tout (${data.length})`}
          </button>
        )}
      </div>

      {data.length === 0 || data.every((d) => d.value === 0) ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{L("Aucune donnée disponible", "No data available")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2" style={{ maxHeight: showAll ? '400px' : '192px', overflowY: showAll ? 'auto' : 'visible' }}>
          {visibleData.map((d, i) => {
            const barWidthPercent = (d.value / maxValue) * 100;
            const isOnBar = barWidthPercent > 30; // barre occupe +30% → texte sur la barre
            // ⭐ Si le texte n'est PAS sur la barre, on le place À DROITE de la barre
            //    (en dehors du container gris) au lieu de sur le gris — blanc sur gris
            //    était invisible. Maintenant : blanc sur bleu si sur la barre,
            //    slate-700 à droite de la barre si hors barre.
            return (
              <div key={i} className="flex items-center space-x-3">
                <span className="text-xs font-medium text-gray-600 w-20 truncate" title={d.label}>
                  {d.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barWidthPercent}%`,
                      background: d.color || 'linear-gradient(to right, #1A2BA6, #3B4FD4)',
                    }}
                  />
                  {/* ⭐ Texte adaptatif : blanc si sur la barre colorée (>30%),
                      sinon affiché dans une bulle blanche à droite de la barre */}
                  {isOnBar ? (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-sm"
                    >
                      {formatNumber(d.value)}
                    </span>
                  ) : null}
                </div>
                {/* ⭐ Si la barre est < 30%, on affiche le nombre À DROITE du container
                    gris (au lieu de blanc sur gris invisible) */}
                {!isOnBar && (
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">
                    {formatNumber(d.value)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composant — Graphique en donut SVG (répartition)
// ──────────────────────────────────────────────────────────────────────────

interface DonutDataPoint {
  label: string;
  value: number;
  color: string;
}

function DonutChartCard({ title, data, icon: Icon, accentColor }: {
  title: string;
  data: DonutDataPoint[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}) {
  const L = useL();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Calcul des arcs
  let cumulativePercent = 0;
  const arcs = data.map((d) => {
    const percent = total > 0 ? d.value / total : 0;
    const startAngle = cumulativePercent * 2 * Math.PI;
    const endAngle = (cumulativePercent + percent) * 2 * Math.PI;
    cumulativePercent += percent;
    return { ...d, percent, startAngle, endAngle };
  });

  // Donut parameters
  const cx = 80;
  const cy = 80;
  const r = 60;
  const strokeWidth = 18;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
      </div>

      {total === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <PieChart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{L("Aucune donnée", "No data")}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center space-x-6">
          <svg viewBox="0 0 160 160" className="w-40 h-40">
            {arcs.map((arc, i) => {
              if (arc.percent === 0) return null;
              const x1 = cx + r * Math.cos(arc.startAngle - Math.PI / 2);
              const y1 = cy + r * Math.sin(arc.startAngle - Math.PI / 2);
              const x2 = cx + r * Math.cos(arc.endAngle - Math.PI / 2);
              const y2 = cy + r * Math.sin(arc.endAngle - Math.PI / 2);
              const largeArc = arc.percent > 0.5 ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              );
            })}
            <text x="80" y="76" textAnchor="middle" className="text-[14px] font-bold fill-gray-900">
              {formatNumber(total)}
            </text>
            <text x="80" y="92" textAnchor="middle" className="text-[8px] fill-gray-500 uppercase">
              Total
            </text>
          </svg>
          <div className="space-y-2">
            {arcs.map((arc, i) => (
              <div key={i} className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: arc.color }} />
                <span className="text-xs text-gray-700">{arc.label}</span>
                <span className="text-xs font-bold text-gray-900">{formatNumber(arc.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composant — Graphique en ligne SVG (évolution temporelle)
// ──────────────────────────────────────────────────────────────────────────

interface LineChartDataPoint {
  period: string;
  value: number;
}

function LineChartCard({ title, data, icon: Icon, accentColor, unit }: {
  title: string;
  data: LineChartDataPoint[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  unit?: string;
}) {
  const L = useL();
  // ⭐ Échelle Y : si les valeurs sont des moyennes /20, on va de 0 à 20.
  //    Sinon, on prend le max + 10% de marge.
  const isOutOfTwenty = unit === '/ 20' || (data.length > 0 && data.every(d => d.value <= 20));
  const maxValue = isOutOfTwenty ? 20 : Math.max(...data.map((d) => d.value), 10) * 1.1;
  const minValue = isOutOfTwenty ? 0 : 0;
  const hasData = data.some((d) => d.value > 0);

  // ⭐ Génère les labels Y — pour /20: 0, 5, 10, 15, 20
  const yLabels = isOutOfTwenty ? [0, 5, 10, 15, 20] : [
    Math.round(minValue),
    Math.round(maxValue * 0.25),
    Math.round(maxValue * 0.5),
    Math.round(maxValue * 0.75),
    Math.round(maxValue),
  ];

  // Calcul des points (x, y) avec padding
  const PAD_L = 35, PAD_R = 15, PAD_T = 15, PAD_B = 25;
  const W = 320, H = 180;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const points = data.map((p, i) => {
    const x = PAD_L + (data.length > 1 ? (i * chartW) / (data.length - 1) : chartW / 2);
    const y = PAD_T + chartH - ((p.value - minValue) / (maxValue - minValue)) * chartH;
    return { x, y, ...p };
  });

  // ⭐ Trouve min/max réels pour colorer les points (vert si > 15/20, orange si < 10, bleu sinon)
  const getColor = (value: number) => {
    if (isOutOfTwenty) {
      if (value >= 14) return '#10b981'; // emerald-500
      if (value >= 10) return '#1A2BA6';  // navy
      return '#f59e0b'; // amber-500
    }
    return '#1A2BA6';
  };

  // Path pour la ligne (smooth bezier optionnel — ici linéaire pour clarté)
  const linePath = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : '';
  // Path pour l'aire (line + bottom)
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} Z`
    : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {unit && hasData && (
          <span className="text-xs font-medium text-gray-400">{unit}</span>
        )}
      </div>

      {!hasData ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{L("Aucune donnée disponible", "No data available")}</p>
            <p className="text-xs text-gray-300 mt-1">{L("Les données apparaîtront après la première période", "Data will appear after the first period")}</p>
          </div>
        </div>
      ) : (
        <div className="h-56">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A2BA6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#1A2BA6" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grille horizontale + labels Y */}
            {yLabels.map((label, i) => {
              const y = PAD_T + chartH - ((label - minValue) / (maxValue - minValue)) * chartH;
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PAD_L - 5} y={y + 3} textAnchor="end" className="text-[9px] fill-gray-400 font-medium">
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Aire */}
            {points.length >= 2 && (
              <path d={areaPath} fill="url(#lineAreaGradient)" />
            )}

            {/* Ligne */}
            {points.length >= 2 && (
              <path
                d={linePath}
                fill="none"
                stroke="#1A2BA6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points + labels */}
            {points.map((p, i) => {
              const color = getColor(p.value);
              return (
                <g key={i}>
                  {/* Halo pour le hover */}
                  <circle cx={p.x} cy={p.y} r="8" fill={color} opacity="0.15" />
                  {/* Point principal */}
                  <circle cx={p.x} cy={p.y} r="4.5" fill={color} stroke="white" strokeWidth="2" />
                  {/* Valeur au-dessus */}
                  <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[10px] font-bold fill-gray-700">
                    {p.value > 0 ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(2)) : '—'}
                  </text>
                  {/* Période en bas */}
                  <text x={p.x} y={H - 8} textAnchor="middle" className="text-[10px] fill-gray-500 font-medium">
                    {p.period}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composant — Carte d'accès rapide à un module
// ──────────────────────────────────────────────────────────────────────────

interface QuickAccessItem {
  label: string;
  /** ⭐ P4-final : libellé anglais (piste EN) */
  labelEn?: string;
  description: string;
  descriptionEn?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

const QUICK_ACCESS: QuickAccessItem[] = [
  {
    label: 'Organisation Pédagogique',
    labelEn: 'Pedagogical Organisation',
    description: 'Classes, matières, emplois du temps',
    descriptionEn: 'Classes, subjects, timetables',
    icon: School,
    href: '/app/pedagogy',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    label: 'Élèves & Scolarité',
    labelEn: 'Students & Enrollment',
    description: 'Inscriptions, effectifs, transferts',
    descriptionEn: 'Admissions, headcount, transfers',
    icon: Users,
    href: '/app/students',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    label: 'Finances & Économat',
    labelEn: 'Finance & Store',
    description: 'Recettes, dépenses, trésorerie',
    descriptionEn: 'Revenue, expenses, treasury',
    icon: Wallet,
    href: '/app/finance',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    label: 'Examens & Notes',
    labelEn: 'Exams & Grades',
    description: 'Évaluations, bulletins, moyennes',
    descriptionEn: 'Assessments, report cards, averages',
    icon: GraduationCap,
    href: '/app/exams',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    label: 'Personnel, RH & Paie',
    labelEn: 'Staff, HR & Payroll',
    description: 'Effectifs, salaires, congés',
    descriptionEn: 'Staff, salaries, leaves',
    icon: UserCog,
    href: '/app/hr',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  {
    label: 'Communication',
    labelEn: 'Communication',
    description: 'SMS, emails, notifications',
    descriptionEn: 'SMS, emails, notifications',
    icon: MessageSquare,
    href: '/app/communication',
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  },
];

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Personnalisations de frais de scolarité
// ──────────────────────────────────────────────────────────────────────────

interface TuitionLevelAggregation {
  levelCode: string;
  levelLabel: string;
  studentCount: number;
  originalAmount: number;
  customAmount: number;
  reductionAmount: number;
  reductionPercentage: number;
}

interface TuitionPersonalizationsResponse {
  totalOverrides: number;
  totalOriginalAmount: number;
  totalCustomAmount: number;
  totalReductionAmount: number;
  reductionPercentage: number;
  byLevel: TuitionLevelAggregation[];
  _source?: string;
}

function useTuitionPersonalizations(academicYearId?: string) {
  return useQuery<TuitionPersonalizationsResponse>({
    queryKey: ['dashboard', 'tuition-personalizations', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return null;
      const url = `/api/dashboard/tuition-personalizations?academicYearId=${academicYearId}`;
      const data = await fetchJson(url);
      return data;
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

function TuitionPersonalizationsSection({ academicYearId }: { academicYearId?: string }) {
  const L = useL();
  const { data, isLoading } = useTuitionPersonalizations(academicYearId);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.totalOverrides === 0) {
    // Pas de personnalisations — on n'affiche pas la carte (évite l'encombrement)
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-700 to-amber-600 px-5 py-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Coins className="w-4 h-4" />
          {L("Personnalisations de frais de scolarité", "Tuition fee customisations")}
        </h3>
        <p className="text-[11px] text-amber-100 mt-0.5">
          {L("Élèves bénéficiant d'un tarif personnalisé", "Students with a customised fee")} · {L(`${data.totalOverrides} élève(s) concerné(s)`, `${data.totalOverrides} student(s) concerned`)}
        </p>
      </div>

      {/* Bandeau résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-amber-50/50 border-b border-amber-100">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">{L("Montant standard", "Standard amount")}</p>
          <p className="text-lg font-bold text-slate-700 line-through">{formatCurrency(data.totalOriginalAmount)}</p>
          <p className="text-[10px] text-slate-400">{L("Ce qu'ils auraient dû payer", "What they should have paid")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">{L("Après personnalisation", "After customisation")}</p>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.totalCustomAmount)}</p>
          <p className="text-[10px] text-slate-400">{L("Ce qu'ils vont payer", "What they will pay")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-red-700">{L("Réduction totale", "Total reduction")}</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(data.totalReductionAmount)}</p>
          <p className="text-[10px] text-slate-400">{L(`Soit -${data.reductionPercentage}% en moyenne`, `i.e. -${data.reductionPercentage}% on average`)}</p>
        </div>
      </div>

      {/* Détail par niveau */}
      {data.byLevel.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">{L("Niveau", "Level")}</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-700">{L("Élèves", "Students")}</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-500">{L("Tarif standard", "Standard fee")}</th>
                <th className="text-right px-4 py-2 font-semibold text-emerald-700">{L("Après perso.", "After custom.")}</th>
                <th className="text-right px-4 py-2 font-semibold text-red-700">{L("Réduction", "Reduction")}</th>
                <th className="text-right px-4 py-2 font-semibold text-amber-700">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byLevel.map((lvl) => (
                <tr key={lvl.levelCode} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-900">{lvl.levelLabel}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{lvl.studentCount}</td>
                  <td className="px-4 py-3 text-right text-slate-500 line-through">{formatCurrency(lvl.originalAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(lvl.customAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-700">{formatCurrency(lvl.reductionAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      -{lvl.reductionPercentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-500">
          {L("Note :", "Note:")} {L("Les personnalisations sont des ajustements individuels du tarif de scolarité accordés à certains élèves (bourses, réductions familiales, etc.).", "Customisations are individual adjustments to the tuition fee granted to certain students (scholarships, family discounts, etc.).")}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Évolution des moyennes par niveau scolaire + piste
// ──────────────────────────────────────────────────────────────────────────

interface GradeSeries {
  levelCode: string;
  levelLabel: string;
  track: 'FR' | 'EN';
  scale: 'qualitative' | '/20' | '/100';
  data: Array<{ period: string; value: number }>;
}

interface GradeEvolutionResponse {
  periods: string[];
  series: GradeSeries[];
  bilingualEnabled: boolean;
  _source?: string;
}

function useGradeEvolution(academicYearId?: string) {
  return useQuery<GradeEvolutionResponse>({
    queryKey: ['dashboard', 'grade-evolution', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return null;
      const url = `/api/dashboard/grade-evolution?academicYearId=${academicYearId}`;
      const data = await fetchJson(url);
      return data;
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// Couleurs distinctes pour chaque combinaison niveau + piste
const SERIES_COLORS: Record<string, string> = {
  // Francophone
  'MATERNELLE-FR': '#8b5cf6', // violet (qualitatif)
  'PRIMAIRE-FR': '#1A2BA6',   // navy
  'SECONDAIRE-FR': '#0ea5e9', // sky
  // Anglophone
  'MATERNELLE-EN': '#f59e0b', // amber
  'PRIMAIRE-EN': '#10b981',   // emerald
  'SECONDAIRE-EN': '#ef4444', // red
};

function getSeriesColor(levelCode: string, track: string): string {
  return SERIES_COLORS[`${levelCode}-${track}`] || '#1A2BA6';
}

function GradeEvolutionByLevelSection({ academicYearId }: { academicYearId?: string }) {
  const L = useL();
  const { data, isLoading } = useGradeEvolution(academicYearId);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-5 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#1A2BA6]" />
            <h3 className="text-base font-semibold text-gray-900">Évolution des moyennes par niveau</h3>
          </div>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{L("Aucune donnée disponible", "No data available")}</p>
            <p className="text-xs text-gray-300 mt-1">{L("Les moyennes par période apparaîtront après la première évaluation", "Period averages will appear after the first assessment")}</p>
          </div>
        </div>
      </div>
    );
  }

  const { periods, series, bilingualEnabled } = data;

  // Déterminer l'échelle maximale selon les scales présents
  const hasQuantitative20 = series.some(s => s.scale === '/20');
  const hasQuantitative100 = series.some(s => s.scale === '/100');
  const hasQualitative = series.some(s => s.scale === 'qualitative');

  // Trouver la valeur max pour calculer l'échelle Y
  const maxValue = Math.max(
    ...series.flatMap(s => s.data.map(d => d.value)),
    hasQuantitative100 ? 100 : hasQuantitative20 ? 20 : 10
  );

  // Constantes pour le SVG
  const PAD_L = 40, PAD_R = 15, PAD_T = 20, PAD_B = 30;
  const W = 560, H = 280;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Y labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(maxValue * p));

  // Helper : position x pour une période
  const getX = (i: number) => PAD_L + (periods.length > 1 ? (i * chartW) / (periods.length - 1) : chartW / 2);
  // Helper : position y pour une valeur
  const getY = (v: number) => PAD_T + chartH - (v / maxValue) * chartH;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-[#1A2BA6]" />
          <h3 className="text-base font-semibold text-gray-900">Évolution des moyennes par niveau scolaire</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {hasQuantitative20 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">/ 20</span>}
          {hasQuantitative100 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">/ 100</span>}
          {hasQualitative && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Qualitatif</span>}
        </div>
      </div>

      {/* Légende des séries */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getSeriesColor(s.levelCode, s.track) }}
            />
            <span className="text-slate-700 font-medium">{s.levelLabel}</span>
            {bilingualEnabled && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                s.track === 'FR' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {s.track === 'FR' ? 'FR' : 'EN'}
              </span>
            )}
            <span className="text-[9px] text-slate-400">
              {s.scale === 'qualitative' ? '(qual.)' : s.scale}
            </span>
          </div>
        ))}
      </div>

      {/* Graphique SVG multi-séries */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: '480px' }} preserveAspectRatio="xMidYMid meet">
          {/* Grille horizontale + labels Y */}
          {yLabels.map((label, i) => {
            const y = PAD_T + chartH - (i / 4) * chartH;
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PAD_L - 5} y={y + 3} textAnchor="end" className="text-[9px] fill-gray-400 font-medium">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Périodes (labels X) */}
          {periods.map((period, i) => (
            <text key={i} x={getX(i)} y={H - 8} textAnchor="middle" className="text-[10px] fill-gray-500 font-medium">
              {period}
            </text>
          ))}

          {/* Une ligne par série */}
          {series.map((s, idx) => {
            const color = getSeriesColor(s.levelCode, s.track);
            const path = s.data.length > 0
              ? s.data.map((p, i) => {
                  const x = getX(i);
                  const y = getY(p.value);
                  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                }).join(' ')
              : '';

            return (
              <g key={idx}>
                {/* Aire dégradée sous la ligne (uniquement pour la 1ère série FR de chaque niveau) */}
                {idx < 3 && s.data.length >= 2 && (
                  <path
                    d={`${path} L ${getX(s.data.length - 1).toFixed(1)} ${(PAD_T + chartH).toFixed(1)} L ${getX(0).toFixed(1)} ${(PAD_T + chartH).toFixed(1)} Z`}
                    fill={color}
                    opacity="0.05"
                  />
                )}
                {/* Ligne */}
                {s.data.length >= 2 && (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {/* Points */}
                {s.data.map((p, i) => (
                  <g key={i}>
                    <circle cx={getX(i)} cy={getY(p.value)} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
                  </g>
                ))}
              </g>
            );
          })}

          {/* Tooltip hint via <title> sur chaque point */}
          {series.map((s, idx) =>
            s.data.map((p, i) => (
              <circle
                key={`tip-${idx}-${i}`}
                cx={getX(i)}
                cy={getY(p.value)}
                r="8"
                fill="transparent"
              >
                <title>{`${s.levelLabel} ${s.track} — ${p.period} : ${p.value > 0 ? p.value.toFixed(2) : '—'} ${s.scale === 'qualitative' ? '' : s.scale}`}</title>
              </circle>
            ))
          )}
        </svg>
      </div>

      {/* Note explicative */}
      <div className="mt-3 px-3 py-2 bg-slate-50 rounded text-[10px] text-slate-500">
        <p>
          <span className="font-semibold">Lecture :</span> Chaque ligne représente l'évolution de la moyenne générale des élèves d'un niveau scolaire (et d'une piste linguistique si bilingue activé) sur les périodes de l'année.
          {hasQualitative && ' La maternelle FR utilise une notation qualitative (TS/S/PS) convertie en score pour le graphique.'}
          {bilingualEnabled && ' Les pistes FR et EN sont séparées car elles utilisent des échelles différentes (/20 vs /100).'}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Personnel (administration + enseignants par niveau)
// ──────────────────────────────────────────────────────────────────────────

interface HROverviewResponse {
  totalStaff: number;
  adminStaffCount: number;
  teachersCount: number;
  teachersByLevel: Array<{ levelCode: string; levelLabel: string; count: number }>;
  _source?: string;
}

function useHROverview(tenantId?: string, academicYearId?: string) {
  return useQuery<HROverviewResponse>({
    queryKey: ['dashboard', 'hr-overview', tenantId, academicYearId],
    queryFn: async () => {
      if (!tenantId) return null;
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      const url = `/api/dashboard/hr-overview?${params.toString()}`;
      const data = await fetchJson(url);
      return data;
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

function HROverviewSection({ tenantId, academicYearId }: { tenantId?: string; academicYearId?: string }) {
  const L = useL();
  const { data, isLoading } = useHROverview(tenantId, academicYearId);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.totalStaff === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-rose-900 to-rose-800 px-5 py-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <UserCog className="w-4 h-4" />
          {L("Personnel de l'établissement", "School staff")}
        </h3>
        <p className="text-[11px] text-rose-100 mt-0.5">
          {L(`${data.totalStaff} personne(s) au total`, `${data.totalStaff} staff member(s) in total`)} · {L("Administration + Corps enseignant", "Administration + Teaching staff")}
        </p>
      </div>

      <div className="p-5">
        {/* Bandeau résumé : 2 grandes cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Personnel administratif */}
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl border border-rose-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-rose-100">
                <UserCog className="w-5 h-5 text-rose-700" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-rose-600">{L("Administration", "Administration")}</span>
            </div>
            <p className="text-xs text-gray-600 mb-1">{L("Personnel administratif", "Administrative staff")}</p>
            <p className="text-2xl font-bold text-rose-900">{formatNumber(data.adminStaffCount)}</p>
            <p className="text-[10px] text-rose-600 mt-1">
              {data.totalStaff > 0 ? L(`${Math.round((data.adminStaffCount / data.totalStaff) * 100)}% du personnel`, `${Math.round((data.adminStaffCount / data.totalStaff) * 100)}% of staff`) : '—'}
            </p>
          </div>

          {/* Corps enseignant */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <GraduationCap className="w-5 h-5 text-blue-700" />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">{L("Enseignants", "Teachers")}</span>
            </div>
            <p className="text-xs text-gray-600 mb-1">{L("Corps enseignant", "Teaching staff")}</p>
            <p className="text-2xl font-bold text-blue-900">{formatNumber(data.teachersCount)}</p>
            <p className="text-[10px] text-blue-600 mt-1">
              {data.totalStaff > 0 ? L(`${Math.round((data.teachersCount / data.totalStaff) * 100)}% du personnel`, `${Math.round((data.teachersCount / data.totalStaff) * 100)}% of staff`) : '—'}
            </p>
          </div>
        </div>

        {/* Détail par niveau scolaire */}
        {data.teachersByLevel.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              {L("Enseignants par niveau scolaire", "Teachers by school level")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.teachersByLevel.map((lvl) => (
                <div key={lvl.levelCode} className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{lvl.levelLabel}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{formatNumber(lvl.count)}</p>
                  <p className="text-[9px] text-slate-400">
                    {data.teachersCount > 0 ? L(`${Math.round((lvl.count / data.teachersCount) * 100)}% des enseignants`, `${Math.round((lvl.count / data.teachersCount) * 100)}% of teachers`) : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Distribution des âges
// ──────────────────────────────────────────────────────────────────────────

interface AgeDistributionData {
  global: Array<{ ageRange: string; count: number }>;
  byLevel: Array<{
    levelCode: string;
    levelLabel: string;
    distribution: Array<{ ageRange: string; count: number }>;
  }>;
  totalStudents: number;
}

function useAgeDistribution(tenantId?: string, academicYearId?: string) {
  return useQuery<AgeDistributionData>({
    queryKey: ['dashboard', 'age-distribution', tenantId, academicYearId],
    queryFn: async () => {
      if (!tenantId) return null;
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      return await fetchJson(`/api/dashboard/age-distribution?${params.toString()}`);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// Couleurs pour les barres du graphique par niveau
const AGE_CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function AgeDistributionSection({ tenantId, academicYearId }: { tenantId?: string; academicYearId?: string }) {
  const L = useL();
  const { data, isLoading } = useAgeDistribution(tenantId, academicYearId);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data || data.totalStudents === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 px-5 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4" />
            {L("Distribution des âges", "Age distribution")}
          </h3>
          <p className="text-[11px] text-indigo-100 mt-0.5">{L("Tranches d'âge par niveau scolaire", "Age brackets by school level")}</p>
        </div>
        <div className="p-8 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{L("Aucune donnée disponible", "No data available")}</p>
          <p className="text-xs text-gray-300 mt-1">{L("Les données apparaîtront après l'inscription des élèves", "Data will appear after students are enrolled")}</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.global.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 px-5 py-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4" />
          {L("Distribution des âges", "Age distribution")}
        </h3>
        <p className="text-[11px] text-indigo-100 mt-0.5">
          {L(`${data.totalStudents} élèves`, `${data.totalStudents} students`)} · {L("Tranches d'âge par niveau scolaire", "Age brackets by school level")}
        </p>
      </div>

      <div className="p-5">
        {/* Graphique global (histogramme SVG professionnel) */}
        <p className="text-xs font-semibold text-slate-700 mb-3">{L("Vue globale de l'école", "Whole school overview")}</p>
        <div className="flex items-end justify-between gap-2 h-40 mb-6">
          {data.global.map((item, i) => {
            const heightPercent = (item.count / maxValue) * 100;
            const color = AGE_CHART_COLORS[i % AGE_CHART_COLORS.length];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] font-bold text-slate-700 tabular-nums">{item.count}</span>
                <div className="relative w-full flex items-end" style={{ height: '100px' }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-80"
                    style={{
                      height: `${Math.max(heightPercent, 2)}%`,
                      background: `linear-gradient(to top, ${color}, ${color}cc)`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-slate-500 text-center">{item.ageRange}</span>
              </div>
            );
          })}
        </div>

        {/* Distribution par niveau scolaire */}
        {data.byLevel.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">{L("Par niveau scolaire", "By school level")}</p>
            <div className="space-y-3">
              {data.byLevel.map((level, idx) => {
                const levelMax = Math.max(...level.distribution.map(d => d.count), 1);
                const color = AGE_CHART_COLORS[idx % AGE_CHART_COLORS.length];
                return (
                  <div key={level.levelCode} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">{level.levelLabel}</span>
                      <span className="text-[10px] text-slate-400">
                        {level.distribution.reduce((s, d) => s + d.count, 0)} élèves
                      </span>
                    </div>
                    {/* Mini barres horizontales */}
                    <div className="flex items-center gap-1 h-6">
                      {level.distribution.map((d, i) => {
                        const widthPercent = (d.count / levelMax) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center" title={`${d.ageRange}: ${d.count} élèves`}>
                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden relative">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(widthPercent, 2)}%`, backgroundColor: color }}
                              />
                            </div>
                            {d.count > 0 && (
                              <span className="text-[8px] text-slate-500 mt-0.5">{d.count}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Labels des tranches */}
                    <div className="flex items-center gap-1 mt-1">
                      {level.distribution.map((d, i) => (
                        <span key={i} className="flex-1 text-[7px] text-slate-300 text-center">{d.ageRange.split(' ')[0]}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Analytics des notes (remplace "Moyenne générale")
// ──────────────────────────────────────────────────────────────────────────

interface GradeAnalyticsData {
  byLevel: Array<{
    levelCode: string;
    levelLabel: string;
    scale: 'qualitative' | '/20' | '/100';
    highestAverage: { studentName: string; value: string; className: string } | null;
    lowestAverage: { studentName: string; value: string; className: string } | null;
    topStudents: Array<{ rank: number; studentName: string; average: string; className: string; scale: string }>;
    studentCount: number;
  }>;
  currentPeriod: string;
  totalStudents: number;
}

function useGradeAnalytics(tenantId?: string, academicYearId?: string) {
  return useQuery<GradeAnalyticsData>({
    queryKey: ['dashboard', 'grade-analytics', tenantId, academicYearId],
    queryFn: async () => {
      if (!tenantId) return null;
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      return await fetchJson(`/api/dashboard/grade-analytics?${params.toString()}`);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

function GradeAnalyticsSection({ tenantId, academicYearId }: { tenantId?: string; academicYearId?: string }) {
  const L = useL();
  const { data, isLoading } = useGradeAnalytics(tenantId, academicYearId);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-5 w-64 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.byLevel.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-900 to-purple-700 px-5 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4" />
            {L("Analytics des notes", "Grade analytics")}
          </h3>
          <p className="text-[11px] text-purple-100 mt-0.5">{L("Par niveau scolaire", "By school level")}</p>
        </div>
        <div className="p-8 text-center">
          <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{L("Aucune donnée disponible", "No data available")}</p>
          <p className="text-xs text-gray-300 mt-1">{L("Les résultats apparaîtront après la première évaluation", "Results will appear after the first assessment")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-purple-900 to-purple-700 px-5 py-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4" />
          {L("Analytics des notes", "Grade analytics")}
        </h3>
        <p className="text-[11px] text-purple-100 mt-0.5">
          Période : {data.currentPeriod} · {data.totalStudents} élèves évalués
        </p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {data.byLevel.map((level) => (
            <div key={level.levelCode} className="border border-slate-100 rounded-xl p-4 space-y-3">
              {/* En-tête du niveau */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{level.levelLabel}</h4>
                  <p className="text-[10px] text-slate-400">{level.studentCount} élèves évalués</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  level.scale === 'qualitative'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {level.scale === 'qualitative' ? 'Qualitatif' : level.scale}
                </span>
              </div>

              {/* Plus forte + Plus faible moyenne */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                  <p className="text-[9px] uppercase font-bold text-emerald-600">Plus forte</p>
                  <p className="text-sm font-bold text-emerald-900 mt-0.5">
                    {level.highestAverage?.value || '—'}
                  </p>
                  <p className="text-[9px] text-emerald-600 truncate" title={level.highestAverage?.studentName}>
                    {level.highestAverage?.studentName || '—'}
                  </p>
                  <p className="text-[8px] text-emerald-400">{level.highestAverage?.className || ''}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                  <p className="text-[9px] uppercase font-bold text-red-600">Plus faible</p>
                  <p className="text-sm font-bold text-red-900 mt-0.5">
                    {level.lowestAverage?.value || '—'}
                  </p>
                  <p className="text-[9px] text-red-600 truncate" title={level.lowestAverage?.studentName}>
                    {level.lowestAverage?.studentName || '—'}
                  </p>
                  <p className="text-[8px] text-red-400">{level.lowestAverage?.className || ''}</p>
                </div>
              </div>

              {/* Top 3 élèves */}
              {level.topStudents.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-500 mb-1.5">Top 3</p>
                  <div className="space-y-1">
                    {level.topStudents.map((student) => (
                      <div key={student.rank} className="flex items-center gap-2 text-xs">
                        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0 ${
                          student.rank === 1 ? 'bg-amber-100 text-amber-700'
                          : student.rank === 2 ? 'bg-slate-200 text-slate-600'
                          : 'bg-orange-100 text-orange-700'
                        }`}>
                          {student.rank}
                        </span>
                        <span className="text-slate-700 truncate flex-1">{student.studentName}</span>
                        <span className="font-bold text-slate-900 shrink-0">
                          {student.average}{student.scale === '/20' ? '/20' : ''}
                        </span>
                        <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{student.className}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Note explicative */}
        <div className="mt-3 px-3 py-2 bg-slate-50 rounded text-[10px] text-slate-500">
          {L("Note :", "Note:")} {L(`Ces résultats reflètent la période courante (${data.currentPeriod}).`, `These results reflect the current period (${data.currentPeriod}).`)}
          Pour la maternelle, les notes sont qualitatives (TS = Très Satisfaisant, S = Satisfaisant, PS = Peu Satisfaisant).
          Les moyennes du primaire et secondaire sont sur 20.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────────────────────

interface PilotageDashboardV2Props {
  /** Afficher les boutons d'accès rapide (désactivé pour les rôles non-admin) */
  showQuickAccess?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ NOUVEAU — Section Vue d'ensemble des effectifs + abandons + scolarités
// ──────────────────────────────────────────────────────────────────────────

interface LevelOverview {
  level: string;
  levelCode: string;
  total: number;
  boys: number;
  girls: number;
  abandons: number;
  abandonBoys: number;
  abandonGirls: number;
  active: number;
  abandonsWithPaidTuition: number;
  abandonPaidAmount: number;
  abandonsWithUnpaidTuition: number;
  abandonUnpaidAmount: number;
}

interface OverviewResponse {
  totalStudents: number;
  activeStudents: number;
  totalAbandons: number;
  byLevel: LevelOverview[];
  _sources?: {
    studentsStats: string;
    abandons: string;
    balances: string;
  };
}

function useDashboardOverview(academicYearId?: string, schoolLevelId?: string) {
  return useQuery<OverviewResponse>({
    queryKey: ['dashboard', 'overview', academicYearId, schoolLevelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      const url = `/api/dashboard/overview${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await fetchJson(url);
      return data || { totalStudents: 0, activeStudents: 0, totalAbandons: 0, byLevel: [] };
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

function DashboardOverviewSection({ academicYearId, schoolLevelId }: { academicYearId?: string; schoolLevelId?: string }) {
  const { data, isLoading } = useDashboardOverview(academicYearId, schoolLevelId);
  // ⭐ P4-final : section bilingue (piste EN → anglais)
  const L = useL();

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
            <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || (data.totalStudents === 0 && data.byLevel.length === 0)) {
    return null;
  }

  const { totalStudents, activeStudents, totalAbandons, byLevel } = data;

  return (
    <div className="space-y-4">
      {/* Bandeau des 3 chiffres clés : Total / Actifs / Abandons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total élèves */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">{L("Tous statuts", "All statuses")}</span>
          </div>
          <p className="text-xs text-gray-600 mb-1">{L("Effectif total", "Total headcount")}</p>
          <p className="text-2xl font-bold text-blue-900">{formatNumber(totalStudents)}</p>
          <p className="text-[10px] text-blue-600 mt-1">{L("Y compris les abandons de l'année", "Including this year's dropouts")}</p>
        </div>

        {/* Élèves actifs */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-emerald-100">
              <UserCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">{L("Actuellement scolarisés", "Currently enrolled")}</span>
          </div>
          <p className="text-xs text-gray-600 mb-1">{L("Élèves actifs", "Active students")}</p>
          <p className="text-2xl font-bold text-emerald-900">{formatNumber(activeStudents)}</p>
          <p className="text-[10px] text-emerald-600 mt-1">
            {totalStudents > 0 ? L(`${Math.round((activeStudents / totalStudents) * 100)}% de l'effectif`, `${Math.round((activeStudents / totalStudents) * 100)}% of headcount`) : '—'}
          </p>
        </div>

        {/* Abandons */}
        <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border border-red-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-100">
              <UserX className="w-5 h-5 text-red-700" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-red-600">{L("Année en cours", "Current year")}</span>
          </div>
          <p className="text-xs text-gray-600 mb-1">{L("Abandons", "Dropouts")}</p>
          <p className="text-2xl font-bold text-red-900">{formatNumber(totalAbandons)}</p>
          <p className="text-[10px] text-red-600 mt-1">
            {totalStudents > 0 ? L(`${Math.round((totalAbandons / totalStudents) * 100)}% de l'effectif total`, `${Math.round((totalAbandons / totalStudents) * 100)}% of total headcount`) : '—'}
          </p>
        </div>
      </div>

      {/* Détail par niveau scolaire + scolarités des abandons */}
      {byLevel.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-5 py-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <School className="w-4 h-4 text-gold-400" />
              {L("Effectifs détaillés par niveau scolaire", "Detailed headcount by school level")}
            </h3>
            <p className="text-[11px] text-blue-200 mt-0.5">
              {L("Répartition par sexe, abandons et situation des scolarités", "Gender split, dropouts and tuition status")}
            </p>
          </div>

          {/* Tableau desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">{L("Niveau", "Level")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-700">{L("Total", "Total")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-blue-700">{L("Garçons", "Boys")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-pink-700">{L("Filles", "Girls")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-emerald-700">{L("Actifs", "Active")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-red-700">{L("Abandons", "Dropouts")}</th>
                  <th className="text-right px-4 py-2 font-semibold text-amber-700">
                    {L("Scolarités payées", "Tuition paid")}<br /><span className="text-[9px] font-normal text-amber-500">{L("(par abandons)", "(by dropouts)")}</span>
                  </th>
                  <th className="text-right px-4 py-2 font-semibold text-orange-700">
                    {L("Scolarités dues", "Tuition due")}<br /><span className="text-[9px] font-normal text-orange-500">{L("(par abandons)", "(by dropouts)")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byLevel.map((lvl) => (
                  <tr key={lvl.levelCode} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{lvl.level}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatNumber(lvl.total)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{formatNumber(lvl.boys)}</td>
                    <td className="px-4 py-3 text-right text-pink-700 font-medium">{formatNumber(lvl.girls)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatNumber(lvl.active)}</td>
                    <td className="px-4 py-3 text-right text-red-700 font-medium">{formatNumber(lvl.abandons)}</td>
                    <td className="px-4 py-3 text-right">
                      {lvl.abandonsWithPaidTuition > 0 ? (
                        <div>
                          <div className="font-medium text-amber-700">{lvl.abandonsWithPaidTuition} élève(s)</div>
                          <div className="text-[10px] text-amber-500">{formatCurrency(lvl.abandonPaidAmount)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lvl.abandonsWithUnpaidTuition > 0 ? (
                        <div>
                          <div className="font-medium text-orange-700">{lvl.abandonsWithUnpaidTuition} élève(s)</div>
                          <div className="text-[10px] text-orange-500">{formatCurrency(lvl.abandonUnpaidAmount)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-slate-900">TOTAL</td>
                  <td className="px-4 py-3 text-right text-slate-900">{formatNumber(totalStudents)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatNumber(byLevel.reduce((s, l) => s + l.boys, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-pink-700">
                    {formatNumber(byLevel.reduce((s, l) => s + l.girls, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatNumber(activeStudents)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{formatNumber(totalAbandons)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">
                    {formatCurrency(byLevel.reduce((s, l) => s + l.abandonPaidAmount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-700">
                    {formatCurrency(byLevel.reduce((s, l) => s + l.abandonUnpaidAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cartes mobile (au lieu du tableau) */}
          <div className="md:hidden divide-y divide-slate-100">
            {byLevel.map((lvl) => (
              <div key={lvl.levelCode} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900">{lvl.level}</h4>
                  <span className="text-xs font-medium text-slate-500">
                    {L(`${formatNumber(lvl.total)} élèves`, `${formatNumber(lvl.total)} students`)} • {L(`${formatNumber(lvl.active)} actifs`, `${formatNumber(lvl.active)} active`)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-blue-700 font-bold">{formatNumber(lvl.boys)}</div>
                    <div className="text-[9px] text-blue-500">{L("Garçons", "Boys")}</div>
                  </div>
                  <div className="bg-pink-50 rounded p-2 text-center">
                    <div className="text-pink-700 font-bold">{formatNumber(lvl.girls)}</div>
                    <div className="text-[9px] text-pink-500">{L("Filles", "Girls")}</div>
                  </div>
                  <div className="bg-red-50 rounded p-2 text-center">
                    <div className="text-red-700 font-bold">{formatNumber(lvl.abandons)}</div>
                    <div className="text-[9px] text-red-500">{L("Abandons", "Dropouts")}</div>
                  </div>
                </div>
                {lvl.abandons > 0 && (
                  <div className="text-xs space-y-1 bg-amber-50 rounded p-2">
                    {lvl.abandonsWithPaidTuition > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-700">Scolarités payées par abandons :</span>
                        <span className="font-medium text-amber-700">
                          {lvl.abandonsWithPaidTuition} él. • {formatCurrency(lvl.abandonPaidAmount)}
                        </span>
                      </div>
                    )}
                    {lvl.abandonsWithUnpaidTuition > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-700">Scolarités dues par abandons :</span>
                        <span className="font-medium text-orange-700">
                          {lvl.abandonsWithUnpaidTuition} él. • {formatCurrency(lvl.abandonUnpaidAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Note explicative */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500">
              {L("Note :", "Note:")} {L("Les « scolarités payées par abandons » correspondent au montant total déjà réglé par les élèves qui ont ensuite abandonné. Les « scolarités dues » représentent ce que ces élèves auraient encore dû payer.", "'Tuition paid by dropouts' is the total amount already settled by students who later dropped out. 'Tuition due' is what those students would still have had to pay.")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PilotageDashboardV2({ showQuickAccess = true }: PilotageDashboardV2Props) {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  // ⭐ P4-final : libellés dans la langue du profil (piste EN → anglais)
  const L = useL();

  const academicYearId = currentYear?.id;
  const schoolLevelId = currentLevel?.id;

  // ⭐ Récupérer le tenantId depuis localStorage (pour appeler /api/dashboard/hr-overview)
  //    On le lit une seule fois au mount — pas besoin de re-render si ça change.
  const tenantId = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session.tenantId || session.tenant?.id || undefined;
      }
    } catch {}
    // Fallback : cookie x-tenant-id
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
    return undefined;
  }, []);

  const consolidatedQuery = useConsolidatedReport(academicYearId, schoolLevelId);
  const weightedAvgQuery = useWeightedAverage(academicYearId, schoolLevelId);
  const studentsStatsQuery = useStudentsStatistics(academicYearId, schoolLevelId);
  const financeKpisQuery = useFinanceKpis(academicYearId, schoolLevelId);
  const todayRevenueQuery = useTodayRevenue();

  const isLoading = consolidatedQuery.isLoading || studentsStatsQuery.isLoading;
  const consolidated = consolidatedQuery.data;
  const studentsStats = studentsStatsQuery.data;
  const financeKpis = financeKpisQuery.data;
  const weightedAvg = weightedAvgQuery.data;

  // ─── Niveau scolaire affiché ───
  // ⭐ P4-final : libellés du niveau dans la langue du profil (EN → Nursery/Primary/Secondary)
  const levelLabel = useMemo(() => {
    const isEN = L('fr', 'en') === 'en';
    if (!currentLevel?.code) return isEN ? 'All levels' : 'Tous les niveaux';
    if (currentLevel.code === 'ALL') return isEN ? 'All levels' : 'Tous les niveaux';
    if (currentLevel.code === 'MATERNELLE') return isEN ? 'Nursery' : 'Maternelle';
    if (currentLevel.code === 'PRIMAIRE') return isEN ? 'Primary' : 'Primaire';
    if (currentLevel.code === 'SECONDAIRE') return isEN ? 'Secondary' : 'Secondaire';
    return currentLevel.code;
  }, [currentLevel?.code, L]);

  // ─── Préparation des données pour les graphiques ───

  // Effectifs par classe (barres)
  // ⭐ Afficher jusqu'à 10 classes (au lieu de 6) + bouton "Voir tout"
  const [showAllClasses, setShowAllClasses] = useState(false);
  const enrollmentByClass: BarChartDataPoint[] = useMemo(() => {
    const byClass = studentsStats?.byClass || consolidated?.enrollment?.byLevel || [];
    if (!Array.isArray(byClass)) return [];
    const limit = showAllClasses ? 50 : 6;
    return byClass.slice(0, limit).map((item: any) => ({
      label: item.className || item.name || item.level || item.label || '—',
      value: item.count || item.total || item.value || 0,
    }));
  }, [studentsStats, consolidated, showAllClasses]);

  // Répartition par sexe par niveau scolaire (tableau structuré)
  // ⭐ Tri : Maternelle → Primaire → Secondaire (au lieu de l'ordre alphabétique du backend)
  const LEVEL_ORDER_CODES = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];
  const genderByLevel: Array<{ level: string; boys: number; girls: number; total: number }> = useMemo(() => {
    const raw = studentsStats?.byGenderByLevel || [];
    // Trier par ordre canonique
    return [...raw].sort((a, b) => {
      const aCode = (a.levelCode || a.level || '').toUpperCase();
      const bCode = (b.levelCode || b.level || '').toUpperCase();
      const aIdx = LEVEL_ORDER_CODES.indexOf(aCode);
      const bIdx = LEVEL_ORDER_CODES.indexOf(bCode);
      if (aIdx === -1 && bIdx === -1) return (a.level || '').localeCompare(b.level || '');
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [studentsStats]);

  // Répartition par sexe globale (donut — fallback)
  const genderDistribution: DonutDataPoint[] = useMemo(() => {
    const byGender = studentsStats?.byGender || consolidated?.enrollment?.byGender;
    if (byGender && Array.isArray(byGender) && byGender.length > 0) {
      return byGender.map((item: any) => ({
        label: item.label || item.gender || '—',
        value: item.count || item.total || item.value || 0,
        color: (item.label || item.gender || '').toLowerCase().includes('f') ? '#EC4899' : '#3B82F6',
      }));
    }
    // ⭐ v3.6.0 offline-first : PLUS JAMAIS de répartition fabriquée 51/49 —
    //    sans données byGender réelles (hors ligne sans cache), on rend []
    //    (le donut affiche « Aucune donnée ») au lieu d'inventer des nombres
    //    qui ressemblent à des vraies données (retour terrain « KPI faux »).
    return [];
  }, [studentsStats, consolidated]);

  // Évolution des moyennes (ligne)
  // ⭐ Pas de données fictives : si aucune évolution réelle n'est disponible,
  //    on renvoie [] (le LineChartCard affiche "Aucune donnée disponible").
  const averageEvolution: LineChartDataPoint[] = useMemo(() => {
    const evolution = weightedAvg?.evolution || [];
    if (Array.isArray(evolution) && evolution.length > 0) {
      return evolution.map((p: any) => ({
        period: p.period || p.label || '—',
        value: p.value || p.average || 0,
      }));
    }
    // ⭐ Plus de fallback fictif — on affiche simplement "Aucune donnée"
    return [];
  }, [weightedAvg, consolidated]);

  // ─── Alerte si pas d'année scolaire sélectionnée ───
  if (!academicYearId) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900 mb-1">{L("Tableau de pilotage", "Steering dashboard")}</h1>
          <p className="text-sm text-gray-600">{L("Vue d'ensemble de votre établissement", "Overview of your school")}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-amber-900 mb-2">{L("Année scolaire non sélectionnée", "No school year selected")}</h3>
          <p className="text-sm text-amber-700">
            {L("Sélectionnez une année scolaire pour visualiser les données de pilotage.", "Select a school year to view the steering data.")}
          </p>
        </div>
      </div>
    );
  }

  // ─── KPIs financiers formatés ───
  // ⭐ Le backend finance-reports.service.ts renvoie :
  //    totalDue, totalPaid, totalEncaissement, totalDepenses, soldeNet, tauxRecouvrement
  //    (pas totalRevenue / totalCollected / unpaidAmount — c'était le bug)
  const totalDue = financeKpis?.totalDue ?? 0;
  const totalPaid = financeKpis?.totalPaid ?? 0;
  const totalRevenue = consolidated?.revenue?.total
    || financeKpis?.totalEncaissement
    || financeKpis?.totalRevenue
    || financeKpis?.totalCollected
    || totalPaid
    || 0;
  // ⭐ Impayés = total dû - total payé (= ce qui reste à recouvrer)
  const unpaidAmount = financeKpis?.unpaidAmount
    || financeKpis?.totalUnpaid
    || consolidated?.revenue?.unpaid
    || (totalDue - totalPaid)
    || 0;
  const totalStudents = consolidated?.enrollment?.total || studentsStats?.total || 0;
  const attendanceRate = consolidated?.attendance?.rate || 0;
  const averageGrade = consolidated?.weightedAverage?.value || weightedAvg?.weightedAverage || 0;
  const alertsCount = consolidated?.alerts?.count || 0;

  // KPI data pour KPICards
  const kpiData = {
    enrollment: { total: totalStudents, byLevel: consolidated?.enrollment?.byLevel || [] },
    attendance: { rate: attendanceRate, byLevel: consolidated?.attendance?.byLevel || [] },
    revenue: { total: totalRevenue, byLevel: consolidated?.revenue?.byLevel || [] },
    alerts: { count: alertsCount, items: consolidated?.alerts?.items || [] },
    weightedAverage: { value: averageGrade, byLevel: consolidated?.weightedAverage?.byLevel || [] },
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── En-tête ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900 mb-1">{L("Tableau de pilotage", "Steering dashboard")}</h1>
          <p className="text-sm text-gray-600">
            {currentYear?.name || L("Année en cours", "Current year")} • {levelLabel}
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-3 md:mt-0">
          <button
            type="button"
            onClick={() => {
              consolidatedQuery.refetch();
              studentsStatsQuery.refetch();
              financeKpisQuery.refetch();
              todayRevenueQuery.refetch();
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            {L("Actualiser", "Refresh")}
          </button>
        </div>
      </div>

      {/* ── KPI Cards principales (Effectifs, Assiduité, Recettes, Alertes) ── */}
      <KPICards data={kpiData} isLoading={false} />

      {/* ── Mini KPIs : Recette du jour, Impayés, Recettes encaissées ── */}
      {/* ⭐ La carte "Moyenne générale" a été remplacée par la section
          GradeAnalyticsSection plus bas (plus complète et professionnelle) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpiCard
          label={L("Recette du jour", "Today's revenue")}
          value={formatCurrency(todayRevenueQuery.data || 0)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          subtitle={L("Paiements encaissés aujourd'hui", "Payments collected today")}
          loading={todayRevenueQuery.isLoading}
        />
        <MiniKpiCard
          label={L("Impayés / Arriérés", "Unpaid / Arrears")}
          value={formatCurrency(unpaidAmount)}
          icon={AlertCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          subtitle={L("Scolarités à recouvrer", "Tuition to recover")}
          loading={financeKpisQuery.isLoading}
        />
        <MiniKpiCard
          label={L("Recettes encaissées", "Collected revenue")}
          value={formatCurrency(totalRevenue)}
          icon={Banknote}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          subtitle={L("Total des paiements reçus (année en cours)", "Total payments received (current year)")}
          loading={consolidatedQuery.isLoading}
        />
      </div>

      {/* ⭐ NOUVELLE SECTION — Vue d'ensemble des effectifs (total / actifs / abandons) */}
      <DashboardOverviewSection academicYearId={academicYearId} schoolLevelId={schoolLevelId} />

      {/* ⭐ NOUVELLE SECTION — Distribution des âges */}
      <AgeDistributionSection tenantId={tenantId} academicYearId={academicYearId} />

      {/* ── Section Graphiques : Effectifs par classe + Répartition par sexe ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Effectifs par classe (barres) + bouton "Voir tout" */}
        <div className="lg:col-span-2">
          <BarChartCard
            title={L("Effectifs par classe", "Enrolment by class")}
            data={enrollmentByClass}
            icon={Users}
            accentColor="text-blue-600"
          />
          {/* ⭐ Bouton "Voir tout" pour afficher toutes les classes */}
          {(studentsStats?.byClass?.length || 0) > 6 && (
            <button
              onClick={() => setShowAllClasses(prev => !prev)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              {showAllClasses ? L("Voir moins", "Show less") : L(`Voir tout (${studentsStats?.byClass?.length || 0} classes)`, `Show all (${studentsStats?.byClass?.length || 0} classes)`)}
            </button>
          )}
        </div>
        {/* ⭐ Répartition par sexe PAR NIVEAU SCOLAIRE (tableau structuré) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-pink-600" />
            <h3 className="text-sm font-bold text-slate-800">{L("Répartition par sexe", "Gender split")}</h3>
          </div>
          {genderByLevel.length > 0 ? (
            <div className="space-y-2">
              {genderByLevel.map((lvl) => (
                <div key={lvl.level} className="border border-slate-100 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">{lvl.level}</span>
                    <span className="text-[10px] text-slate-400">{L(`${lvl.total} élèves`, `${lvl.total} students`)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Barre Garçons */}
                    <div
                      className="h-5 rounded-l flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ width: `${lvl.total > 0 ? (lvl.boys / lvl.total * 100) : 0}%`, backgroundColor: '#3B82F6', minWidth: lvl.boys > 0 ? '28px' : '0' }}
                    >
                      {/* ⭐ Espace entre le nombre et la lettre : "43 G" au lieu de "43G" */}
                      {lvl.boys > 0 ? L(`${lvl.boys} G`, `${lvl.boys} B`) : ''}
                    </div>
                    {/* Barre Filles */}
                    <div
                      className="h-5 rounded-r flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ width: `${lvl.total > 0 ? (lvl.girls / lvl.total * 100) : 0}%`, backgroundColor: '#EC4899', minWidth: lvl.girls > 0 ? '28px' : '0' }}
                    >
                      {/* ⭐ Espace entre le nombre et la lettre : "42 F" au lieu de "42F" */}
                      {lvl.girls > 0 ? L(`${lvl.girls} F`, `${lvl.girls} G`) : ''}
                    </div>
                  </div>
                  {/* ⭐ Détail G/F en bas — avec espace aussi */}
                  <div className="flex justify-between mt-0.5 text-[9px] text-slate-400">
                    <span>{L(`Garçons : ${lvl.boys}`, `Boys: ${lvl.boys}`)}</span>
                    <span>{L(`Filles : ${lvl.girls}`, `Girls: ${lvl.girls}`)}</span>
                  </div>
                </div>
              ))}
              {/* Légende */}
              <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-[9px] text-slate-500">{L("Garçons", "Boys")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-pink-500" />
                  <span className="text-[9px] text-slate-500">{L("Filles", "Girls")}</span>
                </div>
              </div>
            </div>
          ) : genderDistribution.length > 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">
              Données globales : {genderDistribution.map(g => `${g.label}: ${g.value}`).join(' · ')}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">Aucune donnée disponible</div>
          )}
        </div>
      </div>

      {/* ⭐ Personnalisations de frais de scolarité */}
      <TuitionPersonalizationsSection academicYearId={academicYearId} />

      {/* ── Analytics des notes + Alertes ORION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* ⭐ Analytics des notes remplace l'évolution des moyennes (plus complet) */}
          <GradeAnalyticsSection tenantId={tenantId} academicYearId={academicYearId} />
        </div>
        <div>
          <OrionAlertsCard
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId === 'ALL' ? undefined : schoolLevelId}
          />
        </div>
      </div>

      {/* ── Liste des alertes actives (si présentes) ── */}
      {alertsCount > 0 && Array.isArray(consolidated?.alerts?.items) && consolidated.alerts.items.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Alertes actives ({alertsCount})
              </h3>
            </div>
            <Link
              href="/app#alertes"
              className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center"
            >
              Voir tout <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {consolidated.alerts.items.slice(0, 5).map((alert: any, i: number) => (
              <div
                key={i}
                className="flex items-start space-x-3 p-3 bg-amber-50/50 border border-amber-100 rounded-lg"
              >
                <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-500' :
                  alert.severity === 'high' ? 'text-orange-500' : 'text-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alert.title || alert.label || alert.message || 'Alerte'}
                  </p>
                  {alert.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.description}</p>
                  )}
                </div>
                {alert.date && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(alert.date).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⭐ Personnel de l'établissement (administration + enseignants par niveau) — en dernier */}
      <HROverviewSection tenantId={tenantId} academicYearId={academicYearId} />

      {/* ── Accès rapide aux modules ── */}
      {showQuickAccess && (
        <div>
          <h2 className="text-lg font-semibold text-navy-900 mb-4">{L("Accès rapide aux modules", "Quick access to modules")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUICK_ACCESS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2.5 rounded-lg border ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900 mb-1">{L(item.label, item.labelEn || item.label)}</p>
                      <p className="text-xs text-gray-500">{L(item.description, item.descriptionEn || item.description)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Indicateur de chargement global discret ── */}
      {isLoading && (
        <div className="text-center py-2">
          <span className="text-xs text-gray-400 inline-flex items-center">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Synchronisation des données en cours…
          </span>
        </div>
      )}
    </div>
  );
}
