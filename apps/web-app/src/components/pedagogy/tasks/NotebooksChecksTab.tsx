'use client';

/**
 * ============================================================================
 * CAHIERS & COPIES — Contrôle des cahiers (leçons à recopier)
 * ============================================================================
 *
 * L'enseignant peut :
 *   1. Sélectionner une classe + date du jour (par défaut aujourd'hui)
 *   2. Voir la liste des élèves de la classe sélectionnée
 *   3. Pour chaque élève :
 *      - Statut du cahier (DONE / NOT_DONE / INCOMPLETE / TO_REDO / PENDING)
 *      - Observation libre (texte)
 *   4. Enregistrer tous les statuts en une fois (batch update via Promise.all)
 *   5. Sous-onglet "Historique" pour consulter le suivi par
 *      Trimestre / Mois / Semaine / Jour
 *
 * Backend :
 *   GET  /api/pedagogy-space/notebook-checks?teacherId&academicYearId&classId?
 *        → [{ homework: {id,title,description,dueDate,class,subject,observations},
 *             students: [{id, studentId, firstName, lastName, matricule, photoUrl,
 *                          status, observation, appreciation, evaluatedAt}] }]
 *   PUT  /api/pedagogy-space/task-students/:id
 *        → body: { status, observation?, appreciation?, score? }
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, NotebookPen, Check, X, AlertTriangle,
  RotateCcw, Clock, Save, CalendarDays, History, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  apiFetch, STATUS_CONFIG, formatDateFR, formatDateInput,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTES — statuts pertinents pour le contrôle des cahiers
// ============================================================================

const NOTEBOOK_STATUSES = ['PENDING', 'DONE', 'NOT_DONE', 'INCOMPLETE', 'TO_REDO'] as const;

// Mapping statut → {cahierPropre, leçonCopiée} pour les badges dérivés
const NOTEBOOK_BADGES: Record<
  string,
  { cahier: { label: string; cls: string }; lecon: { label: string; cls: string } }
> = {
  DONE: {
    cahier: { label: 'Propre', cls: 'bg-emerald-100 text-emerald-700' },
    lecon: { label: 'Copiée', cls: 'bg-emerald-100 text-emerald-700' },
  },
  NOT_DONE: {
    cahier: { label: 'À vérifier', cls: 'bg-slate-100 text-slate-600' },
    lecon: { label: 'Non copiée', cls: 'bg-rose-100 text-rose-700' },
  },
  INCOMPLETE: {
    cahier: { label: 'Propre', cls: 'bg-emerald-100 text-emerald-700' },
    lecon: { label: 'Partielle', cls: 'bg-amber-100 text-amber-700' },
  },
  TO_REDO: {
    cahier: { label: 'À refaire', cls: 'bg-rose-100 text-rose-700' },
    lecon: { label: 'À refaire', cls: 'bg-rose-100 text-rose-700' },
  },
  PENDING: {
    cahier: { label: 'À vérifier', cls: 'bg-slate-100 text-slate-500' },
    lecon: { label: 'Non vérifiée', cls: 'bg-slate-100 text-slate-500' },
  },
};

// ============================================================================
// PROPS
// ============================================================================

interface NotebooksChecksTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}

type InnerTab = 'today' | 'history';
type PeriodKind = 'trimestre' | 'mois' | 'semaine' | 'jour';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function NotebooksChecksTab({
  teacherId,
  academicYearId,
  classes,
}: NotebooksChecksTabProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('today');

  return (
    <div className="space-y-4">
      {/* === En-tête === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-slate-700" />
            Cahiers & Copies
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Vérifiez chaque jour que les élèves ont recopié leurs leçons et
            tiennent correctement leur cahier.
          </p>
        </div>
      </div>

      {/* === Sous-navigation interne === */}
      <div className="flex overflow-x-auto border-b border-slate-100">
        {([
          { id: 'today', label: "Saisie du jour", icon: CalendarDays },
          { id: 'history', label: 'Historique', icon: History },
        ] as const).map((t) => {
          const Icon = t.icon;
          const isActive = innerTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setInnerTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap border-b-2',
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* === Contenu du sous-onglet === */}
      {innerTab === 'today' ? (
        <TodayNotebookCheck
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      ) : (
        <HistoryNotebookCheck
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      )}
    </div>
  );
}

// ============================================================================
// SAISIE DU JOUR
// ============================================================================

function TodayNotebookCheck({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}) {
  const todayStr = formatDateInput(new Date().toISOString());
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // drafts[studentId] = { status, observation }
  const [drafts, setDrafts] = useState<Record<string, { status: string; observation: string }>>({});

  // === Auto-sélection de la 1re classe ===
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // === Chargement des notebook-checks pour la classe sélectionnée ===
  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setChecks([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId, classId });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/notebook-checks?${params.toString()}`,
      );
      setChecks(Array.isArray(data) ? data : []);
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des contrôles', {
        description: e.message,
      });
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // === Filtrer les checks pour la date sélectionnée ===
  const checksForDate = useMemo(() => {
    if (!date) return [];
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return checks.filter((c) => {
      if (!c?.homework?.dueDate) return false;
      const d = new Date(c.homework.dueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    });
  }, [checks, date]);

  // === Stats summary ===
  const summary = useMemo(() => {
    const all = checksForDate.flatMap((c) => c.students || []);
    return {
      total: all.length,
      done: all.filter((s) => (drafts[s.id]?.status || s.status) === 'DONE').length,
      notDone: all.filter((s) => (drafts[s.id]?.status || s.status) === 'NOT_DONE').length,
      incomplete: all.filter((s) => (drafts[s.id]?.status || s.status) === 'INCOMPLETE').length,
      toRedo: all.filter((s) => (drafts[s.id]?.status || s.status) === 'TO_REDO').length,
      pending: all.filter((s) => (drafts[s.id]?.status || s.status) === 'PENDING').length,
    };
  }, [checksForDate, drafts]);

  // === Set draft value ===
  const setDraft = (
    studentId: string,
    patch: Partial<{ status: string; observation: string }>,
  ) => {
    setDrafts((prev) => {
      const current = prev[studentId] || { status: '', observation: '' };
      return {
        ...prev,
        [studentId]: { ...current, ...patch },
      };
    });
  };

  // === Batch save ===
  const handleSave = async () => {
    if (checksForDate.length === 0) return;
    const allStudents = checksForDate.flatMap((c) => c.students || []);
    const dirty = allStudents
      .map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        return {
          id: s.id,
          status: d.status || s.status,
          observation: d.observation ?? s.observation ?? '',
          appreciation: s.appreciation ?? undefined,
          score: s.score ?? undefined,
        };
      })
      .filter(Boolean) as {
      id: string;
      status: string;
      observation: string;
      appreciation?: string;
      score?: number;
    }[];

    if (dirty.length === 0) {
      toast.info('Aucune modification à enregistrer.');
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        dirty.map((d) =>
          apiFetch(`/api/pedagogy-space/task-students/${d.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: d.status,
              observation: d.observation || undefined,
              appreciation: d.appreciation,
              score: d.score,
            }),
          }),
        ),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const ko = results.filter((r) => r.status === 'rejected').length;
      if (ko === 0) {
        toast.success(`${ok} élève(s) mis à jour avec succès.`);
      } else {
        toast.warning(`${ok} mis à jour, ${ko} en échec.`, {
          description: 'Vérifiez les logs et réessayez.',
        });
      }
      setDrafts({});
      await load();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = Object.keys(drafts).length > 0;

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Classe
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Date du contrôle
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
          type="button"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* === États de chargement / vide === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des contrôles…
        </div>
      ) : !classId ? (
        <EmptyState
          icon={NotebookPen}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour démarrer le contrôle."
        />
      ) : checksForDate.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={`Aucune leçon à recopier pour le ${formatDateFR(date)}`}
          subtitle="Créez une activité de type « Leçon à recopier » dans l'onglet Leçons & Récitations pour cette date."
        />
      ) : (
        <>
          {/* === Stats summary === */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <SummaryStat label="Total" value={summary.total} color="text-slate-700" bg="bg-slate-100" />
            <SummaryStat label="Propres + copiées" value={summary.done} color="text-emerald-700" bg="bg-emerald-100" />
            <SummaryStat label="Partielles" value={summary.incomplete} color="text-amber-700" bg="bg-amber-100" />
            <SummaryStat label="Non copiées" value={summary.notDone} color="text-rose-700" bg="bg-rose-100" />
            <SummaryStat label="À refaire" value={summary.toRedo} color="text-purple-700" bg="bg-purple-100" />
          </div>

          {/* === Cartes par homework === */}
          <div className="space-y-4">
            {checksForDate.map((item) => (
              <NotebookCheckCard
                key={item.homework.id}
                item={item}
                drafts={drafts}
                onDraft={(studentId, patch) => setDraft(studentId, patch)}
              />
            ))}
          </div>

          {/* === Barre d'actions (sticky) === */}
          <div className="sticky bottom-4 flex items-center justify-end gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500">
              {hasDirty
                ? `${Object.keys(drafts).length} modification(s) non enregistrée(s)`
                : 'Toutes les modifications sont enregistrées'}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || !hasDirty}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// HISTORIQUE — vue par Trimestre / Mois / Semaine / Jour
// ============================================================================

function HistoryNotebookCheck({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}) {
  const [classId, setClassId] = useState('');
  const [periodKind, setPeriodKind] = useState<PeriodKind>('mois');
  const [anchorDate, setAnchorDate] = useState(formatDateInput(new Date().toISOString()));
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(currentTrimestre(new Date()));
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);

  // Auto-sélection de la 1re classe
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setChecks([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId, classId });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/notebook-checks?${params.toString()}`,
      );
      setChecks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // === Calcul de la plage de dates ===
  const range = useMemo(() => {
    return computeRange(periodKind, periodKind === 'trimestre' ? undefined : anchorDate, trimestre);
  }, [periodKind, anchorDate, trimestre]);

  // === Filtrer les checks par plage ===
  const filtered = useMemo(() => {
    if (!range) return [];
    return checks
      .filter((c) => {
        if (!c?.homework?.dueDate) return false;
        const d = new Date(c.homework.dueDate);
        d.setHours(0, 0, 0, 0);
        const from = new Date(range.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(range.to);
        to.setHours(0, 0, 0, 0);
        return d >= from && d <= to;
      })
      .sort((a, b) => new Date(b.homework.dueDate).getTime() - new Date(a.homework.dueDate).getTime());
  }, [checks, range]);

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Classe
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Période
          </label>
          <select
            value={periodKind}
            onChange={(e) => setPeriodKind(e.target.value as PeriodKind)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="trimestre">Trimestre</option>
            <option value="mois">Mois</option>
            <option value="semaine">Semaine</option>
            <option value="jour">Jour</option>
          </select>
        </div>

        {periodKind === 'trimestre' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Trimestre
            </label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            >
              <option value={1}>T1</option>
              <option value={2}>T2</option>
              <option value={3}>T3</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Date repère
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            />
          </div>
        )}

        <button
          onClick={load}
          disabled={loading}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
          type="button"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* === Plage affichée === */}
      {range && (
        <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
          <span className="font-bold uppercase tracking-widest text-slate-500 mr-2">
            Période :
          </span>
          {formatDateFR(range.from)} → {formatDateFR(range.to)}
          <span className="ml-2 text-slate-400">({filtered.length} contrôle(s))</span>
        </div>
      )}

      {/* === États === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement de l'historique…
        </div>
      ) : !classId ? (
        <EmptyState
          icon={History}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour consulter l'historique."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aucun contrôle sur cette période"
          subtitle="Aucune leçon à recopier n'a été enregistrée pour la période sélectionnée."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isExpanded = expandedHwId === item.homework.id;
            const students = item.students || [];
            const done = students.filter((s: any) => s.status === 'DONE').length;
            const total = students.length;
            return (
              <div
                key={item.homework.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpandedHwId(isExpanded ? null : item.homework.id)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {item.homework.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.homework.class?.name || '—'} •{' '}
                        {item.homework.subject?.name || '—'} •{' '}
                        {formatDateFR(item.homework.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                      {done}/{total} faits
                    </span>
                  </div>
                </button>

                {/* Expanded: table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    {students.length === 0 ? (
                      <p className="px-5 py-4 text-xs text-slate-400 text-center">
                        Aucun élève inscrit dans cette classe.
                      </p>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-3">Élève</th>
                            <th className="px-4 py-3">Statut</th>
                            <th className="px-4 py-3">Observation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((s: any) => {
                            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                            return (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {s.lastName || '—'} {s.firstName || ''}
                                  </p>
                                  {s.matricule && (
                                    <p className="text-xs text-slate-400">Mat: {s.matricule}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                                      cfg.color,
                                    )}
                                  >
                                    <cfg.icon className="w-3 h-3" />
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {s.observation || (
                                    <span className="text-xs text-slate-400 italic">
                                      — Aucune —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CARTE NOTEBOOK CHECK — affiche les élèves d'un homework avec édition inline
// ============================================================================

function NotebookCheckCard({
  item,
  drafts,
  onDraft,
}: {
  item: any;
  drafts: Record<string, { status: string; observation: string }>;
  onDraft: (studentId: string, patch: { status?: string; observation?: string }) => void;
}) {
  const students: any[] = item.students || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header de la leçon */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">
              {item.homework.title}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.homework.class?.name || '—'} •{' '}
              {item.homework.subject?.name || '—'} •{' '}
              {formatDateFR(item.homework.dueDate)}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400 flex-shrink-0">
            {students.length} élève(s)
          </span>
        </div>
        {item.homework.observations && (
          <p className="text-xs text-slate-600 mt-1 italic">
            {item.homework.observations}
          </p>
        )}
      </div>

      {/* Table des élèves */}
      {students.length === 0 ? (
        <p className="px-5 py-6 text-xs text-slate-400 text-center">
          Aucun élève inscrit dans cette classe.
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Cahier</th>
                <th className="px-4 py-3">Leçon copiée</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const draft = drafts[s.id];
                const currentStatus = draft?.status || s.status || 'PENDING';
                const currentObs = draft?.observation ?? s.observation ?? '';
                const badges = NOTEBOOK_BADGES[currentStatus] || NOTEBOOK_BADGES.PENDING;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Élève */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {s.lastName || '—'} {s.firstName || ''}
                      </p>
                      {s.matricule && (
                        <p className="text-xs text-slate-400">Mat: {s.matricule}</p>
                      )}
                    </td>

                    {/* Badge cahier propre (dérivé) */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                          badges.cahier.cls,
                        )}
                      >
                        {badges.cahier.label === 'Propre' ? (
                          <Check className="w-3 h-3" />
                        ) : badges.cahier.label === 'À refaire' ? (
                          <RotateCcw className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {badges.cahier.label}
                      </span>
                    </td>

                    {/* Badge leçon copiée (dérivé) */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                          badges.lecon.cls,
                        )}
                      >
                        {badges.lecon.label === 'Copiée' ? (
                          <Check className="w-3 h-3" />
                        ) : badges.lecon.label === 'Non copiée' ? (
                          <X className="w-3 h-3" />
                        ) : badges.lecon.label === 'Partielle' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : badges.lecon.label === 'À refaire' ? (
                          <RotateCcw className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {badges.lecon.label}
                      </span>
                    </td>

                    {/* Sélecteur de statut */}
                    <td className="px-4 py-3">
                      <select
                        value={currentStatus}
                        onChange={(e) =>
                          onDraft(s.id, { status: e.target.value })
                        }
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold min-w-[140px]"
                      >
                        {NOTEBOOK_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {STATUS_CONFIG[st]?.label || st}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Observation */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={currentObs}
                        onChange={(e) =>
                          onDraft(s.id, { observation: e.target.value })
                        }
                        placeholder="Ex: Cahier très bien tenu"
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium min-w-[200px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================

function SummaryStat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200">
      <div className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1.5', bg, color)}>
        {label}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-xl border border-slate-200 border-dashed">
      <Icon className="w-10 h-10 text-slate-200" />
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS — calcul de plages de dates
// ============================================================================

function currentTrimestre(d: Date): 1 | 2 | 3 {
  const m = d.getMonth(); // 0-11
  // T1: Sep-Dec (8-11), T2: Jan-Mar (0-2), T3: Apr-Jun (3-5)
  // Juillet-Août (6-7) → on rattache à T3
  if (m >= 8 || m === 0 || m === 1 || m === 2) {
    // Sep-Dec → T1 ; Jan-Mar → T2
    if (m >= 8) return 1;
    return 2;
  }
  if (m >= 3 && m <= 5) return 3;
  // Juillet-Août
  return 3;
}

function computeRange(
  kind: PeriodKind,
  anchor?: string,
  trimestre?: 1 | 2 | 3,
): { from: string; to: string } | null {
  const today = anchor ? new Date(anchor) : new Date();
  if (isNaN(today.getTime())) return null;

  if (kind === 'trimestre') {
    const year = today.getFullYear();
    const t = trimestre || 1;
    if (t === 1) {
      // T1 = Sep 1 → Dec 31 (de l'année en cours)
      return {
        from: new Date(year, 8, 1).toISOString(),
        to: new Date(year, 11, 31, 23, 59, 59).toISOString(),
      };
    }
    if (t === 2) {
      // T2 = Jan 1 → Mar 31
      return {
        from: new Date(year, 0, 1).toISOString(),
        to: new Date(year, 2, 31, 23, 59, 59).toISOString(),
      };
    }
    // T3 = Apr 1 → Jun 30 (+ Jul-Aug rattachés)
    return {
      from: new Date(year, 3, 1).toISOString(),
      to: new Date(year, 7, 31, 23, 59, 59).toISOString(),
    };
  }

  if (kind === 'mois') {
    const y = today.getFullYear();
    const m = today.getMonth();
    return {
      from: new Date(y, m, 1).toISOString(),
      to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    };
  }

  if (kind === 'semaine') {
    // Semaine = Lundi → Dimanche contenant la date anchor
    const day = today.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
    const offsetToMonday = (day + 6) % 7; // 0 si Lundi, 6 si Dim
    const monday = new Date(today);
    monday.setDate(today.getDate() - offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday.toISOString(), to: sunday.toISOString() };
  }

  // jour
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { from: d.toISOString(), to: end.toISOString() };
}
