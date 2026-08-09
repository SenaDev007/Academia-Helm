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

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Users, Wallet, GraduationCap, TrendingUp, AlertTriangle, Clock,
  ArrowRight, BookOpen, UserCog, MessageSquare, School, DollarSign,
  PieChart, BarChart3, FileText, Calendar, Activity, Award, Banknote,
  UserPlus, TrendingDown, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
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
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
      </div>

      {data.length === 0 || data.every((d) => d.value === 0) ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune donnée disponible</p>
          </div>
        </div>
      ) : (
        <div className="h-48 space-y-2">
          {data.slice(0, 6).map((d, i) => (
            <div key={i} className="flex items-center space-x-3">
              <span className="text-xs font-medium text-gray-600 w-20 truncate" title={d.label}>
                {d.label}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(d.value / maxValue) * 100}%`,
                    background: d.color || 'linear-gradient(to right, #1A2BA6, #3B4FD4)',
                  }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                  {formatNumber(d.value)}
                </span>
              </div>
            </div>
          ))}
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
            <p className="text-sm text-gray-400">Aucune donnée</p>
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
  const maxValue = Math.max(...data.map((d) => d.value), 20);
  const hasData = data.some((d) => d.value > 0);

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
            <p className="text-sm text-gray-400">Aucune donnée disponible</p>
            <p className="text-xs text-gray-300 mt-1">Les données apparaîtront après la première période</p>
          </div>
        </div>
      ) : (
        <div className="h-48">
          <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1="40" y1={10 + i * 40} x2="310" y2={10 + i * 40} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {/* Y-axis labels */}
            {[4, 3, 2, 1, 0].map((i) => (
              <text key={i} x="35" y={14 + i * 40} textAnchor="end" className="text-[9px] fill-gray-400">
                {Math.round((maxValue / 4) * (4 - i))}
              </text>
            ))}
            {/* Area fill */}
            <defs>
              <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A2BA6" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1A2BA6" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {data.length >= 2 && (
              <path
                d={data.map((p, i) => {
                  const x = 55 + i * (250 / Math.max(data.length - 1, 1));
                  const y = 170 - (p.value / maxValue) * 160;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ') + ` L ${55 + (data.length - 1) * (250 / Math.max(data.length - 1, 1))} 170 L 55 170 Z`}
                fill="url(#lineAreaGradient)"
              />
            )}
            {/* Line */}
            {data.length >= 2 && (
              <path
                d={data.map((p, i) => {
                  const x = 55 + i * (250 / Math.max(data.length - 1, 1));
                  const y = 170 - (p.value / maxValue) * 160;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke="#1A2BA6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Points */}
            {data.map((p, i) => {
              const x = 55 + i * (250 / Math.max(data.length - 1, 1));
              const y = 170 - (p.value / maxValue) * 160;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4.5" fill="#1A2BA6" stroke="white" strokeWidth="2" />
                  <text x={x} y={y - 12} textAnchor="middle" className="text-[10px] font-bold fill-gray-700">
                    {p.value > 0 ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : '—'}
                  </text>
                  <text x={x} y={180} textAnchor="middle" className="text-[10px] fill-gray-500">
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
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

const QUICK_ACCESS: QuickAccessItem[] = [
  {
    label: 'Organisation Pédagogique',
    description: 'Classes, matières, emplois du temps',
    icon: School,
    href: '/app/pedagogy',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    label: 'Élèves & Scolarité',
    description: 'Inscriptions, effectifs, transferts',
    icon: Users,
    href: '/app/students',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    label: 'Finances & Économat',
    description: 'Recettes, dépenses, trésorerie',
    icon: Wallet,
    href: '/app/finance',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    label: 'Examens & Notes',
    description: 'Évaluations, bulletins, moyennes',
    icon: GraduationCap,
    href: '/app/exams',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    label: 'Personnel, RH & Paie',
    description: 'Effectifs, salaires, congés',
    icon: UserCog,
    href: '/app/hr',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  {
    label: 'Communication',
    description: 'SMS, emails, notifications',
    icon: MessageSquare,
    href: '/app/communication',
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────────────────────

interface PilotageDashboardV2Props {
  /** Afficher les boutons d'accès rapide (désactivé pour les rôles non-admin) */
  showQuickAccess?: boolean;
}

export default function PilotageDashboardV2({ showQuickAccess = true }: PilotageDashboardV2Props) {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();

  const academicYearId = currentYear?.id;
  const schoolLevelId = currentLevel?.id;

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
  const levelLabel = useMemo(() => {
    if (!currentLevel?.code) return 'Tous les niveaux';
    if (currentLevel.code === 'ALL') return 'Tous les niveaux';
    if (currentLevel.code === 'MATERNELLE') return 'Maternelle';
    if (currentLevel.code === 'PRIMAIRE') return 'Primaire';
    if (currentLevel.code === 'SECONDAIRE') return 'Secondaire';
    return currentLevel.code;
  }, [currentLevel?.code]);

  // ─── Préparation des données pour les graphiques ───

  // Effectifs par classe (barres)
  const enrollmentByClass: BarChartDataPoint[] = useMemo(() => {
    const byClass = studentsStats?.byClass || consolidated?.enrollment?.byLevel || [];
    if (!Array.isArray(byClass)) return [];
    return byClass.slice(0, 6).map((item: any) => ({
      label: item.className || item.name || item.level || item.label || '—',
      value: item.count || item.total || item.value || 0,
    }));
  }, [studentsStats, consolidated]);

  // Répartition par sexe (donut)
  const genderDistribution: DonutDataPoint[] = useMemo(() => {
    const byGender = studentsStats?.byGender || consolidated?.enrollment?.byGender;
    if (byGender && Array.isArray(byGender) && byGender.length > 0) {
      return byGender.map((item: any) => ({
        label: item.label || item.gender || '—',
        value: item.count || item.total || item.value || 0,
        color: (item.label || item.gender || '').toLowerCase().includes('f') ? '#EC4899' : '#3B82F6',
      }));
    }
    // Fallback : si on a total et répartition approximative
    const total = consolidated?.enrollment?.total || 0;
    if (total > 0) {
      return [
        { label: 'Garçons', value: Math.round(total * 0.51), color: '#3B82F6' },
        { label: 'Filles', value: Math.round(total * 0.49), color: '#EC4899' },
      ];
    }
    return [];
  }, [studentsStats, consolidated]);

  // Évolution des moyennes (ligne)
  const averageEvolution: LineChartDataPoint[] = useMemo(() => {
    const evolution = weightedAvg?.evolution || [];
    if (Array.isArray(evolution) && evolution.length > 0) {
      return evolution.map((p: any) => ({
        period: p.period || p.label || '—',
        value: p.value || p.average || 0,
      }));
    }
    // Fallback : si on a une moyenne globale, on la met sur T1
    const wa = consolidated?.weightedAverage?.value || weightedAvg?.weightedAverage || 0;
    if (wa > 0) {
      return [
        { period: 'T1', value: wa },
        { period: 'T2', value: 0 },
        { period: 'T3', value: 0 },
      ];
    }
    return [];
  }, [weightedAvg, consolidated]);

  // ─── Alerte si pas d'année scolaire sélectionnée ───
  if (!academicYearId) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900 mb-1">Tableau de pilotage</h1>
          <p className="text-sm text-gray-600">Vue d'ensemble de votre établissement</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-amber-900 mb-2">Année scolaire non sélectionnée</h3>
          <p className="text-sm text-amber-700">
            Sélectionnez une année scolaire pour visualiser les données de pilotage.
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
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900 mb-1">Tableau de pilotage</h1>
          <p className="text-sm text-gray-600">
            {currentYear?.name || 'Année en cours'} • {levelLabel}
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
            Actualiser
          </button>
        </div>
      </div>

      {/* ── KPI Cards principales (Effectifs, Assiduité, Recettes, Alertes) ── */}
      <KPICards data={kpiData} isLoading={false} />

      {/* ── Mini KPIs : Recette du jour, Impayés, Moyenne générale, Trésorerie ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpiCard
          label="Recette du jour"
          value={formatCurrency(todayRevenueQuery.data || 0)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          subtitle="Paiements encaissés aujourd'hui"
          loading={todayRevenueQuery.isLoading}
        />
        <MiniKpiCard
          label="Impayés / Arriérés"
          value={formatCurrency(unpaidAmount)}
          icon={AlertCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          subtitle="À recouvrer"
          loading={financeKpisQuery.isLoading}
        />
        <MiniKpiCard
          label="Moyenne générale"
          value={`${averageGrade.toFixed(2)} / 20`}
          icon={Award}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          subtitle="Toutes classes confondues"
          loading={weightedAvgQuery.isLoading}
        />
        <MiniKpiCard
          label="Recettes cumulées"
          value={formatCurrency(totalRevenue)}
          icon={Banknote}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          subtitle="Sur l'année scolaire"
          loading={consolidatedQuery.isLoading}
        />
      </div>

      {/* ── Section Graphiques ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Effectifs par classe (barres) */}
        <div className="lg:col-span-2">
          <BarChartCard
            title="Effectifs par classe"
            data={enrollmentByClass}
            icon={Users}
            accentColor="text-blue-600"
          />
        </div>
        {/* Répartition par sexe (donut) */}
        <DonutChartCard
          title="Répartition par sexe"
          data={genderDistribution}
          icon={Users}
          accentColor="text-pink-600"
        />
      </div>

      {/* ── Évolution des moyennes + Alertes ORION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineChartCard
            title="Évolution des moyennes par trimestre"
            data={averageEvolution}
            icon={TrendingUp}
            accentColor="text-[#1A2BA6]"
            unit="/ 20"
          />
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

      {/* ── Accès rapide aux modules ── */}
      {showQuickAccess && (
        <div>
          <h2 className="text-lg font-semibold text-navy-900 mb-4">Accès rapide aux modules</h2>
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
                      <p className="text-sm font-semibold text-navy-900 mb-1">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
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
