/**
 * ORION Score Dashboard Component
 *
 * Displays the ORION institutional score with:
 * - Global score (0-100) with circular progress indicator
 * - Grade (A-F) with colour coding
 * - Trend indicator (IMPROVING / STABLE / DECLINING)
 * - Sub-scores for each domain (Academic, Finance, HR, Compliance, Security)
 * - Top alerts and recommendations
 *
 * Uses shadcn/ui Card, Progress, Badge components and follows
 * the existing codebase design patterns.
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { aiGatewayApi, type OrionScore } from '@/lib/api/ai-gateway';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  Banknote,
  Users,
  FileCheck,
  Lock,
  AlertTriangle,
  Lightbulb,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Grade colour mapping
// ---------------------------------------------------------------------------

const GRADE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400' },
  B: { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' },
  C: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  D: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-400' },
  F: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-400' },
};

// ---------------------------------------------------------------------------
// Trend helpers
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: OrionScore['trend'] }) {
  switch (trend) {
    case 'IMPROVING':
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    case 'DECLINING':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    case 'STABLE':
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
}

function TrendLabel({ trend }: { trend: OrionScore['trend'] }) {
  const styles: Record<OrionScore['trend'], string> = {
    IMPROVING: 'text-emerald-600 bg-emerald-50',
    STABLE: 'text-gray-600 bg-gray-100',
    DECLINING: 'text-red-600 bg-red-50',
  };
  const labels: Record<OrionScore['trend'], string> = {
    IMPROVING: 'En amélioration',
    STABLE: 'Stable',
    DECLINING: 'En baisse',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', styles[trend])}>
      <TrendIcon trend={trend} />
      {labels[trend]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-score configuration
// ---------------------------------------------------------------------------

interface SubScoreConfig {
  key: keyof OrionScore['subScores'];
  label: string;
  icon: typeof BookOpen;
  variant: 'default' | 'success' | 'warning' | 'error' | 'indigo';
}

const SUB_SCORE_CONFIGS: SubScoreConfig[] = [
  { key: 'academic', label: 'Académique', icon: BookOpen, variant: 'indigo' },
  { key: 'finance', label: 'Finance', icon: Banknote, variant: 'success' },
  { key: 'hr', label: 'RH', icon: Users, variant: 'default' },
  { key: 'compliance', label: 'Conformité', icon: FileCheck, variant: 'warning' },
  { key: 'security', label: 'Sécurité', icon: Lock, variant: 'error' },
];

// ---------------------------------------------------------------------------
// Circular progress indicator
// ---------------------------------------------------------------------------

interface CircularProgressProps {
  value: number;       // 0-100
  size?: number;       // px
  strokeWidth?: number;
  grade: OrionScore['grade'];
}

function CircularProgress({ value, size = 140, strokeWidth = 10, grade }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const gradeStyle = GRADE_STYLES[grade] || GRADE_STYLES.C;

  // Score color for the progress arc
  const scoreColor =
    value >= 80 ? 'text-emerald-500' :
    value >= 60 ? 'text-amber-500' :
    'text-red-500';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(scoreColor, 'transition-all duration-700 ease-out')}
        />
      </svg>
      {/* Centre content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{Math.round(value)}</span>
        <span className={cn('text-sm font-bold px-2 py-0.5 rounded', gradeStyle.bg, gradeStyle.text)}>
          {grade}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrionScoreCardProps {
  /** Optional school ID override */
  schoolId?: string;
  /** Optional pre-fetched score (skips internal fetch) */
  score?: OrionScore;
  /** Optional class name for the outer container */
  className?: string;
  /** Optional alert items to display */
  alerts?: Array<{ title: string; level: 'INFO' | 'ATTENTION' | 'CRITIQUE'; description: string }>;
  /** Optional recommendation items to display */
  recommendations?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrionScoreCard({
  schoolId,
  score: externalScore,
  className,
  alerts = [],
  recommendations = [],
}: OrionScoreCardProps) {
  const [score, setScore] = useState<OrionScore | null>(externalScore ?? null);
  const [isLoading, setIsLoading] = useState(!externalScore);
  const [error, setError] = useState<string | null>(null);

  // Fetch score if not provided externally
  useEffect(() => {
    if (externalScore) {
      setScore(externalScore);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchScore() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await aiGatewayApi.getOrionScore(schoolId);
        if (!cancelled) setScore(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Impossible de charger le score ORION.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchScore();
    return () => { cancelled = true; };
  }, [externalScore, schoolId]);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Chargement du score ORION…</p>
        </div>
      </Card>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error || !score) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
          <p className="text-sm text-gray-700 font-medium mb-1">Score indisponible</p>
          <p className="text-xs text-gray-500">{error || 'Aucune donnée de score trouvée.'}</p>
        </div>
      </Card>
    );
  }

  // -----------------------------------------------------------------------
  // Derive variant from sub-score value
  // -----------------------------------------------------------------------

  function progressVariant(value: number): 'success' | 'warning' | 'error' {
    if (value >= 70) return 'success';
    if (value >= 40) return 'warning';
    return 'error';
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* ---- Header ---- */}
      <CardHeader className="bg-slate-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-wide">Score ORION</CardTitle>
              <p className="text-xs opacity-70">
                Calculé le {new Date(score.calculatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <TrendLabel trend={score.trend} />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* ---- Global score + sub-scores ---- */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
          {/* Circular progress */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <CircularProgress value={score.globalScore} grade={score.grade} />
            <p className="text-xs text-gray-500 font-medium">Score global</p>
          </div>

          {/* Sub-scores */}
          <div className="flex-1 w-full space-y-4">
            {SUB_SCORE_CONFIGS.map((cfg) => {
              const SubIcon = cfg.icon;
              const subValue = score.subScores[cfg.key];
              return (
                <div key={cfg.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SubIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        subValue >= 70 ? 'text-emerald-600' :
                        subValue >= 40 ? 'text-amber-600' :
                        'text-red-600',
                      )}
                    >
                      {Math.round(subValue)}/100
                    </span>
                  </div>
                  <Progress
                    value={subValue}
                    size="md"
                    variant={progressVariant(subValue)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Alerts ---- */}
        {alerts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Alertes prioritaires
              </h4>
              <Badge variant="destructive" className="text-[10px]">
                {alerts.length}
              </Badge>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {alerts.map((alert, idx) => {
                const levelConfig =
                  alert.level === 'CRITIQUE'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : alert.level === 'ATTENTION'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800';

                const badgeVariant =
                  alert.level === 'CRITIQUE'
                    ? 'destructive'
                    : alert.level === 'ATTENTION'
                      ? 'secondary'
                      : 'outline';

                return (
                  <div key={idx} className={cn('rounded-lg p-3 border', levelConfig)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{alert.title}</span>
                      <Badge variant={badgeVariant} className="text-[10px]">{alert.level}</Badge>
                    </div>
                    <p className="text-xs opacity-80">{alert.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Recommendations ---- */}
        {recommendations.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Recommandations
              </h4>
            </div>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
