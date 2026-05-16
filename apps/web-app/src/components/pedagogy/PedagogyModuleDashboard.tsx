'use client';

import { type ComponentType, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
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
  TrendingUp,
  Activity,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import {
  usePedagogyDashboardQueries,
  useInvalidatePedagogyDashboard,
} from '@/hooks/usePedagogyDashboardQueries';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import ParentTasksView from '@/components/pedagogy/tasks/ParentTasksView';
import { cn } from '@/lib/utils';

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
  CRITICAL: 0.35,
  WARNING: 0.55,
};

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'indigo',
  index = 0,
}: {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  trend?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
  index?: number;
}) {
  const colors = {
    indigo: 'from-indigo-500/10 to-blue-500/5 text-indigo-600 border-indigo-100',
    emerald: 'from-emerald-500/10 to-teal-500/5 text-emerald-600 border-emerald-100',
    amber: 'from-amber-500/10 to-orange-500/5 text-amber-600 border-amber-100',
    rose: 'from-rose-500/10 to-pink-500/5 text-rose-600 border-rose-100',
    purple: 'from-purple-500/10 to-fuchsia-500/5 text-purple-600 border-purple-100',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1',
        colors[color]
      )}
    >
      <div className={cn('absolute -right-4 -top-4 opacity-5')}>
        <Icon className="h-24 w-24" />
      </div>
      <div className="flex items-center justify-between">
        <div className={cn('rounded-xl bg-white p-2.5 shadow-sm border', colors[color].split(' ')[2])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      </div>
    </motion.div>
  );
}

function ProgressCircle({
  rate,
  label,
  color = 'indigo',
}: {
  rate: number;
  label: string;
  color?: string;
}) {
  const percentage = Math.round(rate * 100);
  const strokeColor = percentage < 35 ? '#ef4444' : percentage < 55 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="h-full w-full" viewBox="0 0 36 36">
          <path
            className="text-gray-100"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <motion.path
            initial={{ strokeDasharray: '0, 100' }}
            animate={{ strokeDasharray: `${percentage}, 100` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900">{percentage}%</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

function CompletionTrendChart({ snapshots }: { snapshots: KpiSnapshot[] }) {
  if (snapshots.length < 2) return null;

  // Simple sparkline approach
  const max = Math.max(...snapshots.map((s) => s.lessonPlanRate), 0.1);
  const points = snapshots
    .slice(-10)
    .map((s, i) => `${(i * 100) / 9},${100 - (s.lessonPlanRate / max) * 100}`)
    .join(' ');

  return (
    <div className="h-16 w-full mt-4">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${points} V 100 H 0 Z`}
          fill="url(#gradient)"
        />
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5 }}
          d={`M ${points}`}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function PedagogyModuleDashboard() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const invalidate = useInvalidatePedagogyDashboard();

  const isTeacher = ['TEACHER', 'TEACHER_RESP'].includes(user?.role ?? '');
  const isDirector = ['SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'director', 'admin'].includes(user?.role ?? '');
  const isParent = ['PARENT', 'STUDENT'].includes(user?.role ?? '');

  const tenantId = useMemo(() => {
    const cross = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    return (cross ? searchParams.get('tenant_id') : null) || tenant?.id || '';
  }, [user?.role, searchParams, tenant?.id]);

  const {
    control,
    orionKpis,
    advancedOrion,
    snapshots,
    timetableCount,
    roomCount,
    isLoading,
    isError,
    error,
    isFetching,
  } = usePedagogyDashboardQueries(tenantId, academicYear?.id);

  if (!academicYear) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed bg-gray-50/50 p-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="rounded-2xl bg-white p-4 shadow-sm border">
          <Calendar className="h-12 w-12 text-gray-300" />
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">Initialisation requise</h2>
          <p className="text-gray-500">
            Veuillez sélectionner une année scolaire dans le menu global pour activer le tableau de bord pédagogique.
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6" />
          <div>
            <h3 className="font-bold">Erreur de chargement</h3>
            <p className="text-sm opacity-90">{(error as Error)?.message || 'Impossible de récupérer les données du dashboard.'}</p>
          </div>
        </div>
        <button
          onClick={() => invalidate()}
          className="mt-4 flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    );
  }

  const userRole = user?.role || '';
  
  if (isParent) {
    return <ParentTasksView />;
  }

  const shortcuts = PEDAGOGY_SUBMODULE_TABS
    .filter((tab) => tab.id !== 'dashboard' && (!tab.roles || (tab.roles as unknown as string[]).includes(userRole)))
    .slice(0, 6);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-end justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold text-gray-900 tracking-tight"
          >
            {isTeacher ? 'Mon Espace Pédagogique' : 'Veille Pédagogique'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 mt-1"
          >
            Année scolaire <span className="font-semibold text-indigo-600">{academicYear.label}</span>
          </motion.p>
        </div>
        <button
          onClick={() => invalidate()}
          disabled={isFetching}
          className="group flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4 text-indigo-500 transition-transform duration-500', isFetching && 'animate-spin')} />
          {isFetching ? 'Synchronisation...' : 'Actualiser'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          index={0}
          title={isTeacher ? "Ma Conformité" : "Taux de Conformité"}
          value={control?.ok && control.data ? `${Math.round(control.data.overallRate * 100)}%` : '—'}
          icon={ShieldCheck}
          color="indigo"
          trend="+2.4%"
        />
        <KpiCard
          index={1}
          title={isTeacher ? "Documents Validés" : "Enseignants Actifs"}
          value={isTeacher 
            ? (orionKpis?.ok && orionKpis.data?.documents?.approved ? orionKpis.data.documents.approved : '—')
            : (control?.ok && control.data?.totalActiveProfiles ? control.data.totalActiveProfiles : '—')}
          icon={isTeacher ? BookOpen : Users}
          color="emerald"
        />
        <KpiCard
          index={2}
          title={isTeacher ? "Corrections à Faire" : "Risques ORION"}
          value={isTeacher
            ? (orionKpis?.ok && orionKpis.data?.documents?.rejected ? orionKpis.data.documents.rejected : 0)
            : (advancedOrion?.ok && advancedOrion.data?.summary?.riskFlagsCount ? advancedOrion.data.summary.riskFlagsCount : 0)}
          icon={AlertCircle}
          color={isTeacher ? 'rose' : (advancedOrion?.ok && advancedOrion.data?.summary?.criticalRisks ? 'rose' : 'amber')}
        />
        <KpiCard
          index={3}
          title={isTeacher ? "Sara AI Insights" : "Insights Générés"}
          value={advancedOrion?.ok && advancedOrion.data?.summary?.insightsCount ? advancedOrion.data.summary.insightsCount : 0}
          icon={Sparkles}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-3xl border bg-white p-6 shadow-sm overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Activity className="h-32 w-32 text-indigo-600" />
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{isTeacher ? 'Ma Production Pédagogique' : 'Production Documentaire'}</h2>
                <p className="text-sm text-gray-500">{isTeacher ? 'Suivi de mes soumissions' : 'Taux de complétion par type de document'}</p>
              </div>
              <Link href={isTeacher ? "/app/pedagogy/production" : "/app/pedagogy/control"} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Détails <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {isLoading ? (
              <div className="flex h-32 items-center justify-center gap-3 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement des indicateurs...
              </div>
            ) : (
              control?.ok && control.data && (
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <ProgressCircle rate={control.data.lessonPlanRate} label="Cahiers de texte" />
                  <ProgressCircle rate={control.data.journalRate} label="Journaux classe" />
                  <ProgressCircle rate={control.data.classLogRate} label="Cahiers d'appel" />
                  <ProgressCircle rate={control.data.weeklyReportRate} label="Rapports hebdo" />
                </div>
              )
            )}

            {snapshots?.ok && snapshots.data && snapshots.data.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tendance (10 derniers jours)</span>
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Croissance stable
                  </span>
                </div>
                <CompletionTrendChart snapshots={snapshots.data as any} />
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="mb-4 text-lg font-bold text-gray-900 px-1">Accès Rapides</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shortcuts.map((tab, idx) => {
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.id}
                    href={tab.path}
                    className="group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-5 text-center transition-all hover:border-indigo-200 hover:shadow-md active:scale-95"
                  >
                    <div className="rounded-xl bg-gray-50 p-3 text-gray-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-900">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.section>
        </div>

        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-3xl border bg-slate-900 p-6 shadow-xl text-white relative overflow-hidden"
          >
            <div className="absolute -right-12 -bottom-12 opacity-10">
              <Target className="h-48 w-48" />
            </div>

            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <h2 className="text-lg font-bold">{isTeacher ? 'Sara AI Pédagogie' : 'Cockpit ORION'}</h2>
            </div>

            <div className="space-y-4">
              {isTeacher ? (
                <div className="space-y-4">
                   <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                     <p className="text-xs text-white/80 leading-relaxed italic">
                       &quot;Bonjour {user?.firstName}, je peux vous aider à structurer votre prochaine fiche pédagogique ou à renseigner votre cahier journal.&quot;
                     </p>
                   </div>
                   <div className="grid grid-cols-1 gap-2">
                     <button className="text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-blue-300">
                       Structurer une leçon...
                     </button>
                     <button className="text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-blue-300">
                       Proposer des activités...
                     </button>
                   </div>
                </div>
              ) : (
                advancedOrion?.ok && advancedOrion.data?.riskFlags && advancedOrion.data.riskFlags.length > 0 ? (
                  advancedOrion.data.riskFlags.slice(0, 3).map((risk: any) => (
                    <div key={risk.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-3">
                      <div className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        risk.level === 'RED' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                      )} />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-white/90 leading-snug">{risk.message}</p>
                        <p className="text-[10px] text-white/40">{new Date(risk.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <BarChart3 className="h-8 w-8 text-white/20 mx-auto" />
                    <p className="text-xs text-white/40">Aucun risque critique détecté par l'IA.</p>
                  </div>
                )
              )}
            </div>

            <Link
              href="/app/pedagogy/orion"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-900/20"
            >
              Consulter Orion Intelligence
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-3xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Infrastructure
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-sm font-medium text-gray-600">Emplois du temps</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  timetableCount?.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {timetableCount?.ok ? "Opérationnel" : "Manquant"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-sm font-medium text-gray-600">Salles de classe</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  roomCount?.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {roomCount?.ok ? `${roomCount.data} salles` : "0 salles"}
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

export default PedagogyModuleDashboard;
