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
  Users,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarRange,
  TrendingUp,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import {
  usePedagogyDashboardQueries,
  useInvalidatePedagogyDashboard,
} from '@/hooks/usePedagogyDashboardQueries';
import { useDirectorPedagogyDashboard } from '@/lib/query/pedagogy-hooks';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import ParentTasksView from '@/components/pedagogy/tasks/ParentTasksView';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// ─── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  index = 0,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
  index?: number;
  href?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
        colors[color]
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('rounded-lg p-2.5 border', colors[color])}>
          <Icon className="h-5 w-5" style={{ color: PRIMARY }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ─── Status Badge ─────────────────────────────────────────────────────
function StatusBadge({ count, type }: { count: number; type: 'pending' | 'validated' | 'rejected' }) {
  const config = {
    pending: { icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'En attente' },
    validated: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Validés' },
    rejected: { icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Rejetés' },
  };
  const { icon: Icon, color, label } = config[type];
  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border', color)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold">{count}</span>
    </div>
  );
}

// ─── Quick Access Card ────────────────────────────────────────────────
function QuickAccessCard({
  href,
  icon: Icon,
  label,
  description,
  badge,
  index,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  badge?: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.06 }}
    >
      <Link
        href={href}
        className="group flex flex-col items-center justify-center gap-3 rounded-xl border bg-white p-5 text-center transition-all border-slate-200 hover:border-slate-300 hover:shadow-sm active:scale-98"
      >
        <div className="relative rounded-lg bg-slate-50 p-3 text-slate-400 transition-colors group-hover:bg-slate-100 group-hover:text-slate-900">
          <Icon className="h-6 w-6" />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
        {description && <span className="text-[11px] text-slate-400 leading-tight">{description}</span>}
      </Link>
    </motion.div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────
function Section({ title, subtitle, children, delay = 0 }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border bg-white p-6 shadow-sm border-slate-200"
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export function PedagogyModuleDashboard() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const invalidate = useInvalidatePedagogyDashboard();

  const isTeacher = ['TEACHER', 'TEACHER_RESP'].includes(user?.role ?? '');
  const isParent = ['PARENT', 'STUDENT'].includes(user?.role ?? '');

  const tenantId = useMemo(() => {
    const cross = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    return (cross ? searchParams.get('tenant_id') : null) || tenant?.id || '';
  }, [user?.role, searchParams, tenant?.id]);

  // Existing queries (structure, timetables, rooms, control dashboard, ORION)
  const {
    control,
    structure,
    timetableCount,
    roomCount,
    orionKpis,
    isLoading: isLoadingQueries,
  } = usePedagogyDashboardQueries(tenantId, academicYear?.id);

  // Director dashboard (for validation counts — cahier journal, fiches, registres, evaluations, monthly plans)
  const { data: directorDashboard, isLoading: isLoadingDirector } = useDirectorPedagogyDashboard(academicYear?.id);

  if (!academicYear) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 rounded-xl border-2 border-dashed bg-gray-50/50 p-12 text-center border-slate-200">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
          <Calendar className="h-12 w-12 text-slate-300" />
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Initialisation requise</h2>
          <p className="text-slate-500 text-sm">
            Veuillez sélectionner une année scolaire dans le menu global pour activer le tableau de bord pédagogique.
          </p>
        </div>
      </div>
    );
  }

  if (isParent) {
    return <ParentTasksView />;
  }

  const shortcuts = pedagogyVisibleTabs.filter((tab) => tab.id !== 'dashboard').slice(0, 8);

  const isLoading = isLoadingQueries || isLoadingDirector;

  // Extract data safely
  const levelsCount = structure?.ok ? (structure.data as any)?.levels ?? 0 : 0;
  const cyclesCount = structure?.ok ? (structure.data as any)?.cycles ?? 0 : 0;
  const ttCount = timetableCount?.ok ? timetableCount.data : 0;
  const rooms = roomCount?.ok ? roomCount.data : 0;

  // Director dashboard data (validation direction)
  const dir = directorDashboard as any;
  const pendingCahierJournals = dir?.pendingCahierJournals ?? 0;
  const pendingFiches = dir?.pendingFiches ?? 0;
  const pendingRegisters = dir?.pendingAttendanceRegisters ?? 0;
  const pendingEvaluations = dir?.pendingMonthlyEvaluations ?? 0;
  const pendingMonthlyPlans = dir?.pendingMonthlyPlans ?? 0;
  const totalPending = dir?.totalPending ?? (pendingCahierJournals + pendingFiches + pendingRegisters + pendingEvaluations);
  const totalValidated = dir?.totalValidated ?? 0;
  const totalRejected = dir?.totalRejected ?? 0;

  // Teacher control data
  const activeProfiles = control?.ok ? (control.data as any)?.totalActiveProfiles ?? 0 : 0;
  const activeAssignments = control?.ok ? (control.data as any)?.totalActiveAssignments ?? 0 : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tableau de bord pédagogique</h1>
          <p className="text-sm text-slate-500">
            Année {academicYear.label} · {isTeacher ? 'Vue enseignant' : 'Vue direction'}
          </p>
        </div>
        <button
          onClick={() => invalidate()}
          disabled={isLoading}
          className="group flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-gray-50 border-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 transition-transform duration-500', isLoading && 'animate-spin')} style={{ color: PRIMARY }} />
          {isLoading ? 'Synchronisation...' : 'Actualiser'}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm">Chargement des indicateurs...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ═══ KPIs Row 1 — Structure & Infrastructure ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Niveaux scolaires"
              value={levelsCount}
              subtitle={cyclesCount > 0 ? `${cyclesCount} cycles` : undefined}
              icon={Layers}
              color="blue"
              index={0}
              href="/app/pedagogy/academic-structure"
            />
            <KpiCard
              title="Emplois du temps"
              value={ttCount}
              subtitle={ttCount > 0 ? 'Configurés' : 'Non configurés'}
              icon={Calendar}
              color={ttCount > 0 ? 'emerald' : 'amber'}
              index={1}
              href="/app/pedagogy/timetables"
            />
            <KpiCard
              title="Salles de classe"
              value={rooms}
              subtitle={rooms > 0 ? 'Disponibles' : 'Non configurées'}
              icon={BookOpen}
              color={rooms > 0 ? 'emerald' : 'amber'}
              index={2}
              href="/app/pedagogy/academic-structure"
            />
            {!isTeacher && (
              <KpiCard
                title="En attente validation"
                value={totalPending}
                subtitle={`${totalValidated} validés · ${totalRejected} rejetés`}
                icon={ClipboardList}
                color={totalPending > 0 ? 'rose' : 'emerald'}
                index={3}
                href="/app/pedagogy/control"
              />
            )}
            {isTeacher && (
              <KpiCard
                title="Profil enseignant"
                value={activeProfiles > 0 ? 'Actif' : '—'}
                subtitle={activeAssignments > 0 ? `${activeAssignments} affectation(s)` : undefined}
                icon={Users}
                color={activeProfiles > 0 ? 'emerald' : 'amber'}
                index={3}
                href="/app/pedagogy/teachers"
              />
            )}
          </div>

          {/* ═══ KPIs Row 2 — Validation Direction (non-teacher only) ═══ */}
          {!isTeacher && totalPending > 0 && (
            <Section
              title="Validations en attente"
              subtitle="Documents soumis par les enseignants en attente de validation"
              delay={0.3}
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {pendingCahierJournals > 0 && (
                  <Link href="/app/pedagogy/control" className="block">
                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700">Cahiers Journal</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-900">{pendingCahierJournals}</span>
                    </div>
                  </Link>
                )}
                {pendingFiches > 0 && (
                  <Link href="/app/pedagogy/control" className="block">
                    <div className="p-4 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700">Fiches Péd.</span>
                      </div>
                      <span className="text-2xl font-bold text-purple-900">{pendingFiches}</span>
                    </div>
                  </Link>
                )}
                {pendingRegisters > 0 && (
                  <Link href="/app/pedagogy/control" className="block">
                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">Registres</span>
                      </div>
                      <span className="text-2xl font-bold text-amber-900">{pendingRegisters}</span>
                    </div>
                  </Link>
                )}
                {pendingEvaluations > 0 && (
                  <Link href="/app/pedagogy/control" className="block">
                    <div className="p-4 rounded-lg border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-cyan-600" />
                        <span className="text-xs font-semibold text-cyan-700">Évaluations</span>
                      </div>
                      <span className="text-2xl font-bold text-cyan-900">{pendingEvaluations}</span>
                    </div>
                  </Link>
                )}
                {pendingMonthlyPlans > 0 && (
                  <Link href="/app/pedagogy/control" className="block">
                    <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarRange className="h-4 w-4 text-rose-600" />
                        <span className="text-xs font-semibold text-rose-700">Planif. Mens.</span>
                      </div>
                      <span className="text-2xl font-bold text-rose-900">{pendingMonthlyPlans}</span>
                    </div>
                  </Link>
                )}
                {totalPending === 0 && (
                  <div className="col-span-5 flex items-center justify-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mr-2" />
                    <span className="text-sm font-semibold text-emerald-700">Toutes les soumissions ont été traitées</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ═══ KPIs Row 3 — Synthèse globale (non-teacher) ═══ */}
          {!isTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Section title="Documents validés" delay={0.4}>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">{totalValidated}</h3>
                    <p className="text-xs text-slate-500">Documents validés au total</p>
                  </div>
                </div>
              </Section>
              <Section title="Documents rejetés" delay={0.5}>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 border border-rose-200">
                    <XCircle className="h-8 w-8 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">{totalRejected}</h3>
                    <p className="text-xs text-slate-500">Documents rejetés (à corriger)</p>
                  </div>
                </div>
              </Section>
              <Section title="Total traités" delay={0.6}>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 border border-blue-200">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">{totalPending + totalValidated + totalRejected}</h3>
                    <p className="text-xs text-slate-500">Documents traités (toutes catégories)</p>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ═══ Quick Access ═══ */}
          <Section title="Accès rapides" subtitle="Naviguez vers les sous-modules" delay={0.7}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {shortcuts.map((tab, i) => {
                const Icon = tab.icon;
                // Show badge for "Validation Direction" if there are pending items
                const badge = tab.id === 'director-space' && !isTeacher && totalPending > 0 ? totalPending : undefined;
                return (
                  <QuickAccessCard
                    key={tab.id}
                    href={tab.path}
                    icon={Icon}
                    label={tab.label}
                    badge={badge}
                    index={i}
                  />
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

export default PedagogyModuleDashboard;
