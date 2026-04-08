'use client';

import { type ComponentType, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Building2,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import {
  usePedagogyDashboardQueries,
  useInvalidatePedagogyDashboard,
} from '@/hooks/usePedagogyDashboardQueries';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface ControlDashboard {
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  overallRate: number;
  totalActiveAssignments: number;
  totalActiveProfiles: number;
  lastCalculatedAt: string | null;
  snapshotsCount: number;
}

interface OrionKpisPayload {
  documents?: {
    total: number;
    submitted: number;
    approved: number;
    rejected: number;
    submissionRate?: number;
    approvalRate?: number;
  };
  semainier?: {
    total: number;
    submitted: number;
    validated: number;
    validationRate?: number;
    totalIncidents?: number;
    criticalIncidents?: number;
  };
  alerts?: unknown[];
}

interface OrionAdvancedSummary {
  insightsCount: number;
  riskFlagsCount: number;
  criticalRisks: number;
  warningRisks: number;
  forecastsCount: number;
}

interface OrionRiskFlag {
  id: string;
  entityType?: string | null;
  level?: string | null;
  message?: string | null;
  createdAt: string;
}

interface OrionAdvancedDash {
  summary: OrionAdvancedSummary | null;
  riskFlags: OrionRiskFlag[];
}

interface KpiSnapshot {
  id: string;
  calculatedAt: string;
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  teacherId?: string | null;
  classId?: string | null;
}

/** Seuils direction — alignés avec la fiche contrôle pédagogique */
const THRESHOLDS = {
  /** Sous ce taux : alerte critique (rouge) */
  CRITICAL: 0.35,
  /** Entre CRITICAL et WARNING : vigilance (ambre) */
  WARNING: 0.55,
  /** Part des documents refusés (sur soumis) déclenchant un avertissement */
  DOC_REJECTION_RATIO: 0.15,
} as const;

type LoadSlice<T> = { ok: true; data: T } | { ok: false; error: string };

type RateTier = 'ok' | 'warn' | 'crit';

function rateTier(rate: number): RateTier {
  if (typeof rate !== 'number' || Number.isNaN(rate)) return 'ok';
  if (rate < THRESHOLDS.CRITICAL) return 'crit';
  if (rate < THRESHOLDS.WARNING) return 'warn';
  return 'ok';
}

function barClassForTier(tier: RateTier) {
  if (tier === 'crit') return 'bg-red-500';
  if (tier === 'warn') return 'bg-amber-500';
  return 'bg-emerald-600';
}

function buildTrendPoints(raw: KpiSnapshot[]): { at: string; overall: number }[] {
  const globalOnly = raw.filter((s) => !s.teacherId && !s.classId);
  const src = globalOnly.length >= 2 ? globalOnly : raw;
  const sorted = [...src].sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
  );
  return sorted.slice(-30).map((s) => ({
    at: s.calculatedAt,
    overall:
      (s.lessonPlanRate + s.journalRate + s.classLogRate + s.weeklyReportRate) / 4,
  }));
}

function CompletionTrendChart({ points }: { points: { at: string; overall: number }[] }) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        Pas assez de snapshots KPI pour afficher une courbe (au moins 2 calculs sur la période).
        Les points sont enregistrés côté contrôle direction.
      </p>
    );
  }

  const w = 420;
  const h = 148;
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = points.length;

  const xy = points.map((p, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + innerH * (1 - Math.min(1, Math.max(0, p.overall)));
    return { x, y };
  });

  const lineD = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `M ${padL} ${padT + innerH} ${xy.map((p) => `L ${p.x} ${p.y}`).join(' ')} L ${padL + innerW} ${padT + innerH} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-w-[300px] max-h-[180px]"
        role="img"
        aria-label="Évolution de la complétion globale dans le temps"
      >
        <defs>
          <linearGradient id="pedagogyTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[THRESHOLDS.WARNING, THRESHOLDS.CRITICAL].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              y1={y}
              x2={w - padR}
              y2={y}
              stroke="#d1d5db"
              strokeWidth={1}
              strokeDasharray="5 4"
            />
          );
        })}
        <path d={areaD} fill="url(#pedagogyTrendFill)" />
        <path d={lineD} fill="none" stroke="#4f46e5" strokeWidth={2.25} strokeLinejoin="round" />
        {xy.map((p, i) => (
          <circle key={points[i].at} cx={p.x} cy={p.y} r={3.5} fill="#4f46e5" />
        ))}
        <text x={padL} y={h - 10} fontSize={10} fill="#6b7280" fontFamily="system-ui, sans-serif">
          Pointillés : seuils {Math.round(THRESHOLDS.WARNING * 100)} % et{' '}
          {Math.round(THRESHOLDS.CRITICAL * 100)} %
        </text>
      </svg>
    </div>
  );
}

function formatRate(rate: number) {
  if (typeof rate !== 'number' || Number.isNaN(rate)) return '—';
  return `${Math.round(rate * 100)} %`;
}

function ProgressRow({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const tier = rateTier(value);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        tier === 'crit'
          ? 'border-red-200 bg-red-50/50'
          : tier === 'warn'
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-gray-100 bg-gray-50/80'
      }`}
    >
      <div className={`rounded-md p-2 ${iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-gray-700">{label}</span>
          <span
            className={`tabular-nums font-medium ${
              tier === 'crit' ? 'text-red-800' : tier === 'warn' ? 'text-amber-900' : 'text-gray-900'
            }`}
          >
            {formatRate(value)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${barClassForTier(tier)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const SHORTCUT_EXCLUDE = new Set(['dashboard', 'control', 'orion-pedagogy']);

export default function PedagogyModuleDashboard() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const { academicYear, schoolLevel, isLoading: contextLoading } = useModuleContext();
  const invalidatePedagogy = useInvalidatePedagogyDashboard();
  const tenantIdForStructure = useMemo(() => {
    const cross = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    const id = cross ? searchParams.get('tenant_id') || tenant?.id : tenant?.id;
    return id && String(id).trim() ? String(id).trim() : undefined;
  }, [user?.role, searchParams, tenant?.id]);
  const {
    control: controlSlice,
    orionAdv: orionAdvSlice,
    orionKpis: orionKpisSlice,
    structure,
    subjectsCount,
    snapshots: snapshotsSlice,
    timetableCount,
    roomCount,
    loading,
  } = usePedagogyDashboardQueries(academicYear?.id, tenantIdForStructure);

  const control = controlSlice as LoadSlice<ControlDashboard> | null;
  const orionAdv = orionAdvSlice as LoadSlice<OrionAdvancedDash> | null;
  const orionKpis = orionKpisSlice as LoadSlice<OrionKpisPayload> | null;
  const snapshots = snapshotsSlice as LoadSlice<KpiSnapshot[]> | null;

  const shortcuts = PEDAGOGY_SUBMODULE_TABS.filter((t) => !SHORTCUT_EXCLUDE.has(t.id));

  if (contextLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Chargement du contexte…
      </div>
    );
  }

  if (!academicYear?.id) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-6 text-center text-sm text-amber-950">
        <p className="font-medium">Sélectionnez une année scolaire</p>
        <p className="mt-1 text-amber-900/90">
          Le tableau de bord pédagogique s’appuie sur l’année active (en-tête). Choisissez une année
          pour afficher les indicateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Barre contexte + actualisation */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Période analysée
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {academicYear.label}
            <span className="font-normal text-gray-500">
              {' '}
              · {schoolLevel?.label ?? 'Tous les niveaux'}
            </span>
          </p>
          {control?.ok && control.data.lastCalculatedAt && (
            <p className="mt-0.5 text-xs text-gray-500">
              KPI complétion calculés le{' '}
              {new Date(control.data.lastCalculatedAt).toLocaleString('fr-FR')}
              {control.data.snapshotsCount > 0
                ? ` · ${control.data.snapshotsCount} snapshot(s)`
                : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void invalidatePedagogy();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {control?.ok && (
        <div className="space-y-2">
          {rateTier(control.data.overallRate) === 'crit' && (
            <div className="flex gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Complétion globale critique</p>
                <p className="mt-0.5 text-red-800/95">
                  Moyenne des quatre axes sous {Math.round(THRESHOLDS.CRITICAL * 100)} %. Prioriser le suivi
                  en contrôle direction.
                </p>
              </div>
            </div>
          )}
          {rateTier(control.data.overallRate) === 'warn' && (
            <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold">Complétion à surveiller</p>
                <p className="mt-0.5 text-amber-900">
                  Entre {Math.round(THRESHOLDS.CRITICAL * 100)} % et{' '}
                  {Math.round(THRESHOLDS.WARNING * 100)} %. Objectif direction : au-dessus de{' '}
                  {Math.round(THRESHOLDS.WARNING * 100)} %.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {orionAdv?.ok && orionAdv.data.summary && orionAdv.data.summary.criticalRisks > 0 && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-semibold">{orionAdv.data.summary.criticalRisks} risque(s)</span> ORION
              au niveau critique (RED).
            </p>
            <Link href="/app/pedagogy/orion" className="font-medium text-red-800 underline">
              Ouvrir analytique →
            </Link>
          </div>
        </div>
      )}
      {orionKpis?.ok &&
        orionKpis.data.documents &&
        orionKpis.data.documents.submitted > 0 &&
        orionKpis.data.documents.rejected / orionKpis.data.documents.submitted >=
          THRESHOLDS.DOC_REJECTION_RATIO && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" />
            <p>
              <span className="font-semibold">Taux de refus documents élevé :</span>{' '}
              {Math.round(
                (orionKpis.data.documents.rejected / orionKpis.data.documents.submitted) * 100,
              )}
              % des soumissions refusées (seuil {Math.round(THRESHOLDS.DOC_REJECTION_RATIO * 100)} %).
            </p>
          </div>
        )}
      {orionKpis?.ok &&
        orionKpis.data.semainier &&
        (orionKpis.data.semainier.criticalIncidents ?? 0) >= 1 && (
          <div className="flex gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>
              <span className="font-semibold">Semainier :</span>{' '}
              {orionKpis.data.semainier.criticalIncidents} incident(s) critiques ou élevés signalés.
            </p>
          </div>
        )}

      {loading && !control ? (
        <div className="flex items-center gap-2 py-8 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des indicateurs…
        </div>
      ) : null}

      {/* KPI synthèse */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Synthèse</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              control?.ok
                ? rateTier(control.data.overallRate) === 'crit'
                  ? 'border-red-300 ring-1 ring-red-200'
                  : rateTier(control.data.overallRate) === 'warn'
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : 'border-gray-200'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Complétion globale</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${
                    control?.ok
                      ? rateTier(control.data.overallRate) === 'crit'
                        ? 'text-red-700'
                        : rateTier(control.data.overallRate) === 'warn'
                          ? 'text-amber-800'
                          : 'text-indigo-700'
                      : 'text-indigo-700'
                  }`}
                >
                  {control?.ok ? formatRate(control.data.overallRate) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Fiches, journaux, cahiers, semainiers
                </p>
              </div>
              <Target className="h-8 w-8 shrink-0 text-indigo-200" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Affectations actives</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {control?.ok ? control.data.totalActiveAssignments : '—'}
                </p>
                <Link
                  href="/app/pedagogy/assignments"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Gérer <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ClipboardList className="h-8 w-8 shrink-0 text-emerald-200" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Profils enseignants</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {control?.ok ? control.data.totalActiveProfiles : '—'}
                </p>
                <Link
                  href="/app/pedagogy/teachers"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Profils académiques <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Users className="h-8 w-8 shrink-0 text-amber-200" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Structure & catalogue</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {structure?.ok ? (
                    <>
                      {structure.data.levels} niveau{structure.data.levels !== 1 ? 'x' : ''}
                      <span className="font-normal text-gray-500">
                        {' '}
                        · {structure.data.cycles} cycle{structure.data.cycles !== 1 ? 's' : ''}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Matières :{' '}
                  {subjectsCount?.ok ? (
                    <span className="font-medium text-gray-700">{subjectsCount.data}</span>
                  ) : (
                    '—'
                  )}
                </p>
                <Link
                  href="/app/pedagogy/academic-structure"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Structure académique <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Layers className="h-8 w-8 shrink-0 text-violet-200" />
            </div>
          </div>
        </div>
        {control && !control.ok && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Contrôle direction : {control.error}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Évolution de la complétion</h2>
            <p className="text-xs text-gray-500">
              Historique des snapshots KPI (moyenne des quatre axes), priorité aux agrégats établissement
            </p>
          </div>
          <Link
            href="/app/pedagogy/control"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Contrôle & snapshots
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {snapshots?.ok ? (
          <CompletionTrendChart points={buildTrendPoints(snapshots.data)} />
        ) : (
          <p className="text-sm text-gray-500">
            {snapshots?.ok === false ? `Historique indisponible : ${snapshots.error}` : 'Chargement…'}
          </p>
        )}
      </section>

      {/* Détail complétion */}
      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Production pédagogique</h2>
            <p className="text-xs text-gray-500">
              Taux de complétion par type de document pour l’année sélectionnée
            </p>
          </div>
          <Link
            href="/app/pedagogy/control"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Détail contrôle direction
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {control?.ok ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <ProgressRow
              label="Fiches / plans de leçon"
              value={control.data.lessonPlanRate}
              icon={FileText}
              iconClass="bg-blue-100 text-blue-700"
            />
            <ProgressRow
              label="Cahier journal"
              value={control.data.journalRate}
              icon={BookOpen}
              iconClass="bg-amber-100 text-amber-800"
            />
            <ProgressRow
              label="Cahier de texte"
              value={control.data.classLogRate}
              icon={ClipboardList}
              iconClass="bg-emerald-100 text-emerald-800"
            />
            <ProgressRow
              label="Semainier"
              value={control.data.weeklyReportRate}
              icon={Calendar}
              iconClass="bg-violet-100 text-violet-800"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {control?.ok === false
              ? 'Impossible d’afficher les taux de complétion.'
              : 'Chargement…'}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Workflow documents (ORION KPIs) */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Documents & semainier</h2>
          <p className="text-xs text-gray-500">Flux issu du workflow pédagogique (ORION)</p>
          {orionKpis?.ok && orionKpis.data.documents ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">Documents total</dt>
                <dd className="text-lg font-semibold tabular-nums text-gray-900">
                  {orionKpis.data.documents.total}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">Soumis</dt>
                <dd className="text-lg font-semibold tabular-nums text-gray-900">
                  {orionKpis.data.documents.submitted}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">Approuvés</dt>
                <dd className="text-lg font-semibold tabular-nums text-emerald-700">
                  {orionKpis.data.documents.approved}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">Refusés</dt>
                <dd className="text-lg font-semibold tabular-nums text-red-700">
                  {orionKpis.data.documents.rejected}
                </dd>
              </div>
              {orionKpis.data.semainier ? (
                <>
                  <div className="col-span-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                    <dt className="text-xs text-gray-500">Semainiers</dt>
                    <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-800">
                      <span>{orionKpis.data.semainier.total} total</span>
                      <span>{orionKpis.data.semainier.validated} validés</span>
                      {typeof orionKpis.data.semainier.criticalIncidents === 'number' &&
                        orionKpis.data.semainier.criticalIncidents > 0 && (
                          <span className="font-medium text-amber-800">
                            {orionKpis.data.semainier.criticalIncidents} incident(s) critiques
                          </span>
                        )}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              {orionKpis?.ok === false
                ? `Données indisponibles : ${orionKpis.error}`
                : 'Chargement ou aucune donnée.'}
            </p>
          )}
        </section>

        {/* Veille ORION avancée */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Veille ORION</h2>
              <p className="text-xs text-gray-500">Insights, risques et prévisions</p>
            </div>
            <Link
              href="/app/pedagogy/orion"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytique
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {orionAdv?.ok && orionAdv.data.summary ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-purple-50 px-2 py-2">
                  <Sparkles className="mx-auto h-4 w-4 text-purple-600" />
                  <p className="mt-1 text-lg font-bold text-purple-900">
                    {orionAdv.data.summary.insightsCount}
                  </p>
                  <p className="text-[10px] font-medium uppercase text-purple-800">Insights</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2">
                  <AlertCircle className="mx-auto h-4 w-4 text-amber-600" />
                  <p className="mt-1 text-lg font-bold text-amber-900">
                    {orionAdv.data.summary.riskFlagsCount}
                  </p>
                  <p className="text-[10px] font-medium uppercase text-amber-900">Risques</p>
                </div>
                <div className="rounded-lg bg-sky-50 px-2 py-2">
                  <BarChart3 className="mx-auto h-4 w-4 text-sky-600" />
                  <p className="mt-1 text-lg font-bold text-sky-900">
                    {orionAdv.data.summary.forecastsCount}
                  </p>
                  <p className="text-[10px] font-medium uppercase text-sky-900">Prévisions</p>
                </div>
              </div>
              {(orionAdv.data.summary.criticalRisks > 0 ||
                orionAdv.data.summary.warningRisks > 0) && (
                <p className="mt-2 text-xs text-amber-800">
                  {orionAdv.data.summary.criticalRisks} critique(s) ·{' '}
                  {orionAdv.data.summary.warningRisks} attention
                </p>
              )}
              {orionAdv.data.riskFlags?.length ? (
                <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {orionAdv.data.riskFlags.slice(0, 3).map((r) => (
                    <li key={r.id} className="text-xs text-gray-700">
                      <span
                        className={`mr-1.5 inline-block rounded px-1.5 py-0.5 font-semibold ${
                          r.level === 'RED'
                            ? 'bg-red-100 text-red-800'
                            : r.level === 'YELLOW'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {r.level ?? '?'}
                      </span>
                      {r.message ?? 'Sans libellé'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-gray-500">Aucun risque enregistré pour cette période.</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              {orionAdv?.ok === false
                ? `Indisponible : ${orionAdv.error}`
                : 'Chargement ou résumé vide.'}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Planning & infrastructures</h2>
        <p className="mb-4 text-xs text-gray-500">
          Données filtrées sur l&apos;année scolaire active (API emplois du temps & salles)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/app/pedagogy/timetables"
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Emplois du temps</p>
                <p className="text-xs text-gray-500">Grilles publiées pour l&apos;année</p>
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums text-indigo-800">
              {timetableCount?.ok ? timetableCount.data : '—'}
            </span>
          </Link>
          <Link
            href="/app/pedagogy/academic-structure?tab=rooms"
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-200 p-2 text-slate-800">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Salles</p>
                <p className="text-xs text-gray-500">Onglet Structure → Salles</p>
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums text-slate-800">
              {roomCount?.ok ? roomCount.data : '—'}
            </span>
          </Link>
        </div>
        {(timetableCount?.ok === false || roomCount?.ok === false) && (
          <p className="mt-3 text-xs text-amber-800">
            {timetableCount?.ok === false && `EDT : ${timetableCount.error}. `}
            {roomCount?.ok === false && `Salles : ${roomCount.error}.`}
          </p>
        )}
      </section>

      {/* Raccourcis */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Accès rapides</h2>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <Icon className="h-4 w-4 text-indigo-600" />
                {tab.label}
              </Link>
            );
          })}
          <Link
            href="/app/pedagogy/control"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
          >
            <ShieldCheck className="h-4 w-4" />
            Contrôle direction
          </Link>
          <Link
            href="/app/pedagogy/orion"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
          >
            <BarChart3 className="h-4 w-4" />
            Analytique ORION
          </Link>
        </div>
      </section>
    </div>
  );
}
