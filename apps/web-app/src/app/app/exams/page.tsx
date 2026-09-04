/**
 * ============================================================================
 * MODULE EXAMENS — TABLEAU DE BORD (Refonte professionnelle)
 * ============================================================================
 *
 * Dashboard professionnel avec :
 *   - KPI cards (Royal Blue + Living Gold palette)
 *   - Graphiques (répartition des statuts, moyennes par classe)
 *   - Alertes et actions rapides
 *   - Vue d'ensemble par niveau scolaire + piste linguistique
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import {
  FileText, ClipboardList, AlertTriangle, CheckCircle2, TrendingUp,
  BarChart3, Calendar, ArrowRight, Clock, ShieldCheck, Award, Users,
  AlertCircle, Zap, Target, Loader2, GraduationCap, BookOpen,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from './sub-modules';
import { useExamSubModules, useExamScope } from './layout';
import { getLabels } from '@/lib/exam-anglophone-config';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';

// ─── Pedagogical ordering ────────────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

export default function ExamsDashboardPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  // ⭐ V10 — en-tête bilingue : la langue suit le niveau sélectionné
  //    (Nursery/Primary → EN, Maternelle/Primaire/Secondaire → FR)
  const { language } = useExamScope();
  const isEN = language === 'EN';
  const labels = getLabels(isEN ? 'EN' : 'FR');

  return (
    <ModuleContainer
      header={{
        title: labels.dashboard,
        description: isEN
          ? 'Overview of the Exams module: assessments, grades and report cards.'
          : "Vue d'ensemble du module examen : évaluations, notes et bulletins.",
        icon: 'fileText',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'dashboard' }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <DashboardContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Dashboard Content ───────────────────────────────────────────────────────

function DashboardContent() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  // ⭐ V10 — la langue est déduite du niveau : Nursery/Primary → interface EN,
  // Maternelle/Primaire/Secondaire → interface FR.
  const isEN = scopeLang === 'EN';
  const labels = getLabels(isEN ? 'EN' : 'FR');

  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const isMaternelle = scopeLevel === 'MATERNELLE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  // ── Load classes ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadClasses() {
      if (!schoolLevelUuid) return;
      try {
        const res = await fetch('/api/all-classes', { credentials: 'include' });
        const data = await res.json();
        const allClasses = Array.isArray(data) ? data : (data?.items || []);
        const levelClasses = allClasses.filter((c: any) =>
          c.schoolLevelId === schoolLevelUuid || c.schoolLevel?.id === schoolLevelUuid
        );
        levelClasses.sort((a: any, b: any) => {
          const idxA = pedagogicalSortIndex(a.name);
          const idxB = pedagogicalSortIndex(b.name);
          if (idxA !== idxB) return idxA - idxB;
          return (a.name || '').localeCompare(b.name || '', 'fr');
        });
        setClasses(levelClasses);
      } catch { setClasses([]); }
    }
    loadClasses();
  }, [schoolLevelUuid]);

  // ── Load evaluations ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadEvals() {
      if (!academicYear?.id || !schoolLevelUuid) return;
      setLoading(true);
      try {
        const res = await institutionalExamsService.getEvaluations({
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevelUuid,
          ...(scopeLang ? { language: scopeLang } : {}),
        });
        setEvaluations(Array.isArray(res) ? res : []);
      } catch { setEvaluations([]); }
      finally { setLoading(false); }
    }
    loadEvals();
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  // ── Compute KPIs from evaluations ─────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = evaluations.length;
    const validated = evaluations.filter(e => e.status === 'VALIDATED').length;
    const planned = evaluations.filter(e => e.status === 'PLANNED').length;
    const submitted = evaluations.filter(e => e.status === 'SUBMITTED').length;
    const openForGrading = evaluations.filter(e => e.status === 'OPEN_FOR_GRADING').length;
    const completionRate = total > 0 ? Math.round((validated / total) * 100) : 0;

    // Group by evaluation type
    const byType = new Map<string, number>();
    for (const ev of evaluations) {
      const code = ev.evaluationType?.code || '—';
      byType.set(code, (byType.get(code) || 0) + 1);
    }

    // Group by status
    const byStatus = {
      VALIDATED: validated,
      PLANNED: planned,
      SUBMITTED: submitted,
      OPEN_FOR_GRADING: openForGrading,
    };

    return { total, validated, planned, submitted, openForGrading, completionRate, byType, byStatus };
  }, [evaluations]);

  // ── Compute per-class stats ───────────────────────────────────────────────
  const classStats = useMemo(() => {
    const map = new Map<string, { className: string; total: number; validated: number }>();
    for (const ev of evaluations) {
      const classId = ev.class?.id || '_no_class';
      const className = ev.class?.name || '—';
      if (!map.has(classId)) {
        map.set(classId, { className, total: 0, validated: 0 });
      }
      const s = map.get(classId)!;
      s.total++;
      if (ev.status === 'VALIDATED') s.validated++;
    }
    return Array.from(map.values()).sort((a, b) =>
      pedagogicalSortIndex(a.className) - pedagogicalSortIndex(b.className)
    );
  }, [evaluations]);

  // ── Evaluation type breakdown for chart ───────────────────────────────────
  const evalTypeBreakdown = useMemo(() => {
    const types = Array.from(kpis.byType.entries()).map(([code, count]) => ({ code, count }));
    const colors: Record<string, string> = {
      EM1: '#0A2A5E', EM2: '#0D3B85', EC: '#114FC4', EP: '#1C6FE8',
      DV: '#CFA63A', INT: '#F2C94C', COMP: '#FFE08A',
    };
    const total = types.reduce((sum, t) => sum + t.count, 0) || 1;
    return types.map(t => ({ ...t, pct: (t.count / total) * 100, color: colors[t.code] || '#94a3b8' }));
  }, [kpis.byType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-slate-500">
          {isEN ? 'Loading dashboard…' : 'Chargement du tableau de bord…'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{labels.dashboard}</h2>
          <p className="text-sm text-slate-500">
            {scopeLevel || '—'} {scopeLang ? `· ${scopeLang}` : ''} · {academicYear?.label || ''}
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Calendar className="w-3 h-3" />
          {format(new Date(), "d MMM yyyy", { locale: isEN ? enUS : fr })}
        </Badge>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total evaluations */}
        <KpiCard
          title={isEN ? 'Total assessments' : 'Évaluations totales'}
          value={kpis.total}
          icon={FileText}
          color="royal-blue"
          subtitle={`${classes.length} ${isEN ? 'classes' : 'classes'} · ${kpis.byType.size} ${isEN ? 'types' : 'types'}`}
        />
        {/* Validated */}
        <KpiCard
          title={isEN ? 'Validated assessments' : 'Évaluations validées'}
          value={kpis.validated}
          icon={CheckCircle2}
          color="emerald"
          subtitle={isEN ? `${kpis.completionRate}% of total` : `${kpis.completionRate}% du total`}
          progress={kpis.completionRate}
        />
        {/* Pending */}
        <KpiCard
          title={isEN ? 'Pending' : 'En attente'}
          value={kpis.submitted + kpis.openForGrading}
          icon={Clock}
          color="amber"
          subtitle={isEN
            ? `${kpis.submitted} submitted · ${kpis.openForGrading} in grading`
            : `${kpis.submitted} soumises · ${kpis.openForGrading} en saisie`}
        />
        {/* Planned */}
        <KpiCard
          title={labels.planned}
          value={kpis.planned}
          icon={Calendar}
          color="slate"
          subtitle={isEN ? 'Not yet opened' : 'Pas encore ouvertes'}
        />
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution (donut-like bar) */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              {isEN ? 'Status distribution' : 'Répartition par statut'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label={labels.validated} count={kpis.byStatus.VALIDATED} total={kpis.total} color="bg-emerald-500" />
            <StatusBar label={labels.submitted} count={kpis.byStatus.SUBMITTED} total={kpis.total} color="bg-amber-500" />
            <StatusBar label={labels.openForGrading} count={kpis.byStatus.OPEN_FOR_GRADING} total={kpis.total} color="bg-blue-500" />
            <StatusBar label={labels.planned} count={kpis.byStatus.PLANNED} total={kpis.total} color="bg-slate-400" />
          </CardContent>
        </Card>

        {/* Evaluation type breakdown */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              {isEN ? 'Assessment type breakdown' : "Répartition par type d'évaluation"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evalTypeBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{isEN ? 'No data' : 'Aucune donnée'}</p>
            ) : (
              <div className="space-y-3">
                {evalTypeBreakdown.map(t => (
                  <div key={t.code} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-24">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: t.color }} />
                      <span className="text-xs font-bold text-slate-700">{t.code}</span>
                    </div>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(t.pct, 5)}%`, backgroundColor: t.color }}
                      >
                        <span className="text-[10px] font-bold text-white">{t.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{t.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Per-class completion ─── */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            {isEN ? 'Progress by class' : 'Progression par classe'}
          </CardTitle>
          <CardDescription className="text-xs">
            {isEN ? 'Validated / total assessments per class' : 'Évaluations validées / total par classe'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classStats.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{isEN ? 'No data available' : 'Aucune donnée disponible'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">{isEN ? 'Class' : 'Classe'}</th>
                    <th className="text-center py-2 px-3 text-xs font-bold text-slate-500 uppercase">Total</th>
                    <th className="text-center py-2 px-3 text-xs font-bold text-slate-500 uppercase">{isEN ? 'Validated' : 'Validées'}</th>
                    <th className="text-center py-2 px-3 text-xs font-bold text-slate-500 uppercase">{isEN ? 'Progress' : 'Progression'}</th>
                  </tr>
                </thead>
                <tbody>
                  {classStats.map((cls, idx) => {
                    const pct = cls.total > 0 ? Math.round((cls.validated / cls.total) * 100) : 0;
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{cls.className}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{cls.total}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn(
                            'font-bold',
                            pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-400'
                          )}>{cls.validated}</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-500',
                                  pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-slate-400'
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-10">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Quick Actions ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          href={`/app/exams/evaluations${scopeLevel ? `?level=${scopeLevel}` : ''}${scopeLang ? `&lang=${scopeLang}` : ''}`}
          icon={FileText}
          title={isEN ? 'Create an assessment' : 'Créer une évaluation'}
          description={isEN ? 'Plan a new assessment' : 'Planifier une nouvelle évaluation'}
          color="royal-blue"
        />
        <QuickAction
          href={`/app/exams/validation${scopeLevel ? `?level=${scopeLevel}` : ''}${scopeLang ? `&lang=${scopeLang}` : ''}`}
          icon={ShieldCheck}
          title={isEN ? 'Validate grades' : 'Valider les notes'}
          description={isEN
            ? `${kpis.submitted} assessment(s) pending`
            : `${kpis.submitted} évaluation(s) en attente`}
          color="amber"
        />
        <QuickAction
          href={`/app/exams/bulletins${scopeLevel ? `?level=${scopeLevel}` : ''}${scopeLang ? `&lang=${scopeLang}` : ''}`}
          icon={Award}
          title={isEN ? 'Generate report cards' : 'Générer les bulletins'}
          description={isEN ? 'Report cards per assessment' : 'Bulletins par évaluation'}
          color="emerald"
        />
      </div>
    </div>
  );
}

// ─── KPI Card Component ─────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, color, subtitle, progress,
}: {
  title: string;
  value: number | string;
  icon: any;
  color: 'royal-blue' | 'emerald' | 'amber' | 'slate';
  subtitle?: string;
  progress?: number;
}) {
  const colorClasses = {
    'royal-blue': { bg: 'bg-[#0A2A5E]', text: 'text-[#0A2A5E]', light: 'bg-blue-50', icon: 'text-blue-600' },
    'emerald': { bg: 'bg-emerald-600', text: 'text-emerald-700', light: 'bg-emerald-50', icon: 'text-emerald-600' },
    'amber': { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', icon: 'text-amber-600' },
    'slate': { bg: 'bg-slate-600', text: 'text-slate-700', light: 'bg-slate-50', icon: 'text-slate-500' },
  };
  const c = colorClasses[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', c.light)}>
        <Icon className={cn('w-5 h-5', c.icon)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
        <p className={cn('text-2xl font-black mt-0.5', c.text)}>{value}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        {progress !== undefined && (
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', c.bg)} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Bar Component ───────────────────────────────────────────────────

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-slate-600 w-20">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
        <div className={cn('h-full rounded transition-all duration-500 flex items-center justify-end pr-2', color)}
          style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct > 5 && <span className="text-[10px] font-bold text-white">{count}</span>}
        </div>
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{count}</span>
    </div>
  );
}

// ─── Quick Action Component ─────────────────────────────────────────────────

function QuickAction({
  href, icon: Icon, title, description, color,
}: {
  href: string;
  icon: any;
  title: string;
  description: string;
  color: 'royal-blue' | 'amber' | 'emerald';
}) {
  const colorClasses = {
    'royal-blue': 'border-[#0A2A5E] hover:bg-[#0A2A5E] hover:text-white text-[#0A2A5E]',
    'amber': 'border-amber-500 hover:bg-amber-500 hover:text-white text-amber-600',
    'emerald': 'border-emerald-600 hover:bg-emerald-600 hover:text-white text-emerald-600',
  };
  return (
    <a
      href={href}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border-2 bg-white transition-all group',
        colorClasses[color]
      )}
    >
      <Icon className="w-6 h-6 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-75">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
