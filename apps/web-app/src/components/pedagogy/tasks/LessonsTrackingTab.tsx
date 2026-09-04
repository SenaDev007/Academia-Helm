'use client';

/**
 * ============================================================================
 * LEÇONS & RÉCITATIONS — Workflow professionnel d'évaluation de la récitation
 * ============================================================================
 *
 * Workflow attendu :
 *   1. L'enseignant sélectionne une date via le calendrier (défaut = aujourd'hui).
 *   2. Le système filtre toutes les leçons (taskType=LESSON) créées dans
 *      « Cahiers & Copies » à cette date, pour la classe sélectionnée.
 *   3. L'enseignant sélectionne une leçon dans la liste → affichage des élèves.
 *   4. Pour chaque élève :
 *        - Récitation : Réussie / Échouée / Non évaluée (3 badges colorés)
 *          → backend status : RECITED / NOT_RECITED / PENDING
 *        - Note : input number /20
 *        - Appréciation : textarea court
 *   5. Enregistrer : batch update via PUT /api/pedagogy-space/task-students/:id
 *   6. Historique : catalogue en dossiers imbriqués
 *      Année > Trimestre > Mois > Semaine > Jour > Leçons + élèves
 *   7. Quand un élève est marqué Réussie / Échouée, le parent le voit via
 *      GET /api/parent/homeworks/:studentId (taskStatus remonté côté backend).
 *
 * Backend :
 *   GET  /api/pedagogy-space/homeworks?teacherId&academicYearId&classId&taskType=LESSON
 *   GET  /api/pedagogy-space/homeworks/:id/students
 *   PUT  /api/pedagogy-space/task-students/:id
 *        body: { status, score?, appreciation?, observation? }
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, Save, CalendarDays, History, BookOpen, Mic,
  ChevronDown, ChevronRight, Folder, FolderOpen, Inbox,
  Check, X, Clock, Award,
} from 'lucide-react';
import {
  apiFetch, formatDateFR, formatDateInput,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTES
// ============================================================================

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Options de récitation : mapping { value, label, color, icon } */
const RECITATION_OPTIONS = [
  {
    value: 'RECITED',
    label: 'Réussie',
    color: 'emerald' as const,
    icon: Check,
  },
  {
    value: 'NOT_RECITED',
    label: 'Échouée',
    color: 'rose' as const,
    icon: X,
  },
  {
    value: 'PENDING',
    label: 'Non évaluée',
    color: 'slate' as const,
    icon: Clock,
  },
];

const COLOR_CLASSES: Record<
  string,
  { active: string; idle: string; dot: string; badge: string }
> = {
  emerald: {
    active: 'bg-emerald-500 text-white border-emerald-500',
    idle: 'text-emerald-700 hover:bg-emerald-50 border-slate-200',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  rose: {
    active: 'bg-rose-500 text-white border-rose-500',
    idle: 'text-rose-700 hover:bg-rose-50 border-slate-200',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700',
  },
  amber: {
    active: 'bg-amber-500 text-white border-amber-500',
    idle: 'text-amber-700 hover:bg-amber-50 border-slate-200',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  slate: {
    active: 'bg-slate-700 text-white border-slate-700',
    idle: 'text-slate-700 hover:bg-slate-50 border-slate-200',
    dot: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-600',
  },
};

// ============================================================================
// PROPS
// ============================================================================

interface LessonsTrackingTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}

type InnerTab = 'today' | 'history';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function LessonsTrackingTab({
  teacherId,
  academicYearId,
  schoolLevelId,
  classes,
}: LessonsTrackingTabProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('today');

  return (
    <div className="space-y-4">
      {/* === En-tête === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-700" />
            Leçons &amp; Récitations
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Sélectionnez une date, choisissez une leçon du jour et évaluez la
            récitation de chaque élève (note + appréciation).
          </p>
        </div>
      </div>

      {/* === Sous-navigation interne === */}
      <div className="flex overflow-x-auto border-b border-slate-100">
        {([
          { id: 'today', label: 'Évaluation du jour', icon: CalendarDays },
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

      {/* === Contenu === */}
      {innerTab === 'today' ? (
        <TodayLessonTracking
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      ) : (
        <HistoryLessonTracking
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      )}
    </div>
  );
}

// ============================================================================
// ÉVALUATION DU JOUR
// ============================================================================

function TodayLessonTracking({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}) {
  const todayStr = formatDateInput(new Date().toISOString());
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingHw, setLoadingHw] = useState(false);
  const [selectedHwId, setSelectedHwId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  // drafts[studentId] = { recitation: 'RECITED'|'NOT_RECITED'|'PENDING'|null, score: string, appreciation: string }
  const [drafts, setDrafts] = useState<
    Record<string, { recitation: string | null; score: string; appreciation: string }>
  >({});

  // Auto-sélection de la 1re classe
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // === Chargement des leçons (taskType=LESSON) pour la classe sélectionnée ===
  const loadHomeworks = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setLessons([]);
      setSelectedHwId('');
      setStudents([]);
      return;
    }
    setLoadingHw(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId,
        taskType: 'LESSON',
      });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setLessons(Array.isArray(data) ? data : []);
      setSelectedHwId('');
      setStudents([]);
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des leçons', {
        description: e.message,
      });
      setLessons([]);
    } finally {
      setLoadingHw(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    loadHomeworks();
  }, [loadHomeworks]);

  // === Filtrer par date sélectionnée ===
  const lessonsForDate = useMemo(() => {
    if (!date) return [];
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return lessons
      .filter((hw) => {
        if (!hw.dueDate) return false;
        const d = new Date(hw.dueDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === target.getTime();
      })
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
  }, [lessons, date]);

  // === Re-sélectionner automatiquement si la leçon sélectionnée disparaît ===
  useEffect(() => {
    if (selectedHwId && !lessonsForDate.some((h) => h.id === selectedHwId)) {
      setSelectedHwId('');
      setStudents([]);
      setDrafts({});
    }
  }, [lessonsForDate, selectedHwId]);

  // === Chargement des élèves pour le homework sélectionné ===
  const loadStudents = useCallback(async () => {
    if (!selectedHwId) {
      setStudents([]);
      setDrafts({});
      return;
    }
    setLoadingStudents(true);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${selectedHwId}/students`,
      );
      setStudents(Array.isArray(data) ? data : []);
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedHwId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const selectedHw = useMemo(
    () => lessons.find((h) => h.id === selectedHwId) || null,
    [lessons, selectedHwId],
  );

  // === Helpers draft ===
  const setDraft = (
    studentId: string,
    patch: Partial<{
      recitation: string | null;
      score: string;
      appreciation: string;
    }>,
  ) => {
    setDrafts((prev) => {
      const current =
        prev[studentId] || { recitation: null, score: '', appreciation: '' };
      return { ...prev, [studentId]: { ...current, ...patch } };
    });
  };

  // === Stats ===
  const summary = useMemo(() => {
    let recited = 0, notRecited = 0, pending = 0, scored = 0;
    let sumScores = 0;
    for (const s of students) {
      const d = drafts[s.id];
      const status =
        d?.recitation !== null && d?.recitation !== undefined
          ? d.recitation
          : s.status || 'PENDING';
      if (status === 'RECITED') recited++;
      else if (status === 'NOT_RECITED') notRecited++;
      else pending++;

      const scoreVal =
        d?.score !== '' && d?.score !== undefined
          ? parseFloat(d.score)
          : s.score;
      if (scoreVal != null && !isNaN(scoreVal)) {
        scored++;
        sumScores += scoreVal;
      }
    }
    const avg = scored > 0 ? Math.round((sumScores / scored) * 10) / 10 : null;
    return { total: students.length, recited, notRecited, pending, scored, avg };
  }, [students, drafts]);

  // === Batch save ===
  const handleSave = async () => {
    if (students.length === 0) return;
    const dirty = students
      .map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        const hasRecitation = d.recitation !== null;
        const hasScore = d.score !== '';
        const hasAppreciation = d.appreciation !== '' && d.appreciation !== (s.appreciation ?? '');
        if (!hasRecitation && !hasScore && !hasAppreciation) return null;
        const status =
          d.recitation !== null
            ? d.recitation
            : s.status || 'PENDING';
        const scoreNum =
          d.score !== ''
            ? parseFloat(d.score)
            : s.score != null
            ? s.score
            : undefined;
        return {
          id: s.id,
          status,
          score: !isNaN(scoreNum as number) ? scoreNum : undefined,
          appreciation:
            d.appreciation !== '' ? d.appreciation : (s.appreciation ?? undefined),
          observation: s.observation ?? undefined,
        };
      })
      .filter(Boolean) as {
      id: string;
      status: string;
      score?: number;
      appreciation?: string;
      observation?: string;
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
              score: d.score,
              appreciation: d.appreciation,
              observation: d.observation,
            }),
          }),
        ),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const ko = results.filter((r) => r.status === 'rejected').length;
      if (ko === 0) {
        toast.success(`${ok} élève(s) mis à jour. Les parents peuvent voir le résultat.`);
      } else {
        toast.warning(`${ok} mis à jour, ${ko} en échec.`, {
          description: 'Vérifiez la console et réessayez.',
        });
      }
      setDrafts({});
      await loadStudents();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = Object.keys(drafts).length > 0;
  const maxScore = selectedHw?.maxScore || 20;

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

        <div className="min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Date (calendrier)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          />
        </div>

        <button
          onClick={loadHomeworks}
          disabled={loadingHw}
          type="button"
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loadingHw && 'animate-spin')} />
        </button>
      </div>

      {/* === Bandeau de la date sélectionnée === */}
      <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-sm text-slate-700">
        <CalendarDays className="w-4 h-4 text-slate-500" />
        <span className="font-semibold">{formatDateFR(date)}</span>
        <span className="text-slate-400">•</span>
        <span className="text-xs text-slate-500">
          {lessonsForDate.length} leçon(s) trouvée(s) pour cette date.
        </span>
      </div>

      {/* === Layout 2 colonnes : liste des leçons (gauche) + élèves (droite) === */}
      {!classId ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour voir les leçons du jour."
        />
      ) : loadingHw ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des leçons…
        </div>
      ) : lessonsForDate.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`Aucune leçon programmée pour le ${formatDateFR(date)}`}
          subtitle="Créez d'abord la leçon dans l'onglet « Cahiers & Copies ». Les leçons créées apparaissent ici automatiquement pour évaluation."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* === Liste des leçons (gauche) === */}
          <div className="lg:col-span-1 space-y-2">
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Leçons du jour
              </h4>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {lessonsForDate.map((hw) => {
                const isActive = selectedHwId === hw.id;
                return (
                  <button
                    key={hw.id}
                    onClick={() => setSelectedHwId(hw.id)}
                    type="button"
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all',
                      isActive
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'p-1.5 rounded-lg flex-shrink-0',
                          isActive ? 'bg-white/10' : 'bg-emerald-50 text-emerald-600',
                        )}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-sm truncate">
                          {hw.title}
                        </h5>
                        <p
                          className={cn(
                            'text-xs mt-0.5',
                            isActive ? 'text-slate-300' : 'text-slate-500',
                          )}
                        >
                          {hw.subject?.name || 'Matière générale'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                              isActive
                                ? 'bg-white/10 text-white'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            <Mic className="w-2.5 h-2.5" />
                            Récitation
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* === Détail élèves (droite) === */}
          <div className="lg:col-span-2">
            {!selectedHwId ? (
              <EmptyState
                icon={Mic}
                title="Sélectionnez une leçon"
                subtitle="Choisissez une leçon dans la liste de gauche pour évaluer la récitation de chaque élève."
              />
            ) : loadingStudents ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Chargement des élèves…
              </div>
            ) : students.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Aucun élève inscrit"
                subtitle="Aucun élève n'est rattaché à cette leçon."
              />
            ) : (
              <>
                {/* === Header de la leçon sélectionnée === */}
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 mb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {selectedHw?.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedHw?.class?.name || '—'} •{' '}
                        {selectedHw?.subject?.name || '—'} •{' '}
                        {formatDateFR(selectedHw?.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">
                        Noté sur {maxScore}
                      </span>
                    </div>
                  </div>
                </div>

                {/* === Stats === */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <SummaryStat
                    label="Réussies"
                    value={summary.recited}
                    color="text-emerald-700"
                    bg="bg-emerald-100"
                  />
                  <SummaryStat
                    label="Échouées"
                    value={summary.notRecited}
                    color="text-rose-700"
                    bg="bg-rose-100"
                  />
                  <SummaryStat
                    label="Non évaluées"
                    value={summary.pending}
                    color="text-slate-600"
                    bg="bg-slate-100"
                  />
                  <SummaryStat
                    label="Moy. /20"
                    valueDisplay={summary.avg != null ? String(summary.avg) : '—'}
                    color="text-blue-700"
                    bg="bg-blue-100"
                  />
                </div>

                {/* === Table élèves === */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <th className="px-4 py-3">Élève</th>
                          <th className="px-4 py-3 min-w-[260px]">Récitation</th>
                          <th className="px-4 py-3">Note /{maxScore}</th>
                          <th className="px-4 py-3 min-w-[260px]">Appréciation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((s) => {
                          const draft = drafts[s.id];
                          const currentRecitation =
                            draft?.recitation !== undefined && draft?.recitation !== null
                              ? draft.recitation
                              : s.status || 'PENDING';
                          const currentScore =
                            draft?.score !== undefined && draft?.score !== ''
                              ? draft.score
                              : s.score != null
                              ? String(s.score)
                              : '';
                          const currentApprec =
                            draft?.appreciation ?? s.appreciation ?? '';
                          return (
                            <tr
                              key={s.id}
                              className="hover:bg-slate-50/50 transition-colors align-top"
                            >
                              {/* Élève */}
                              <td className="px-4 py-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  {s.student?.lastName || s.lastName || '—'}{' '}
                                  {s.student?.firstName || s.firstName || ''}
                                </p>
                                {(s.student?.matricule || s.matricule) && (
                                  <p className="text-xs text-slate-400">
                                    Mat: {s.student?.matricule || s.matricule}
                                  </p>
                                )}
                              </td>

                              {/* Récitation — 3 badges */}
                              <td className="px-4 py-3">
                                <RecitationToggle
                                  value={currentRecitation}
                                  onChange={(v) =>
                                    setDraft(s.id, { recitation: v })
                                  }
                                />
                              </td>

                              {/* Note */}
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max={maxScore}
                                  value={currentScore}
                                  onChange={(e) =>
                                    setDraft(s.id, { score: e.target.value })
                                  }
                                  placeholder="—"
                                  className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-center"
                                />
                              </td>

                              {/* Appréciation */}
                              <td className="px-4 py-3">
                                <textarea
                                  value={currentApprec}
                                  onChange={(e) =>
                                    setDraft(s.id, { appreciation: e.target.value })
                                  }
                                  rows={1}
                                  placeholder="Ex: Très bonne récitation, bonne diction."
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium resize-y min-h-[36px]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* === Barre d'actions (sticky) === */}
                <div className="sticky bottom-4 mt-3 flex items-center justify-end gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500">
                    {hasDirty
                      ? `${Object.keys(drafts).length} modification(s) non enregistrée(s)`
                      : 'Toutes les modifications sont enregistrées'}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasDirty}
                    type="button"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? 'Enregistrement…' : 'Enregistrer les évaluations'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RECITATION TOGGLE — 3 badges colorés (Réussie / Échouée / Non évaluée)
// ============================================================================

function RecitationToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
      {RECITATION_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        const cls = COLOR_CLASSES[opt.color] || COLOR_CLASSES.slate;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(isActive ? null : opt.value)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-md border transition-all',
              isActive ? cls.active : cls.idle,
            )}
          >
            <Icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// HISTORIQUE — vue arborescente Année > Trimestre > Mois > Semaine > Jour
// ============================================================================

function HistoryLessonTracking({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}) {
  const [classId, setClassId] = useState('');
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsByHw, setStudentsByHw] = useState<Record<string, any[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null);

  // Auto-sélection de la 1re classe
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setLessons([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId,
        taskType: 'LESSON',
      });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setLessons(Array.isArray(data) ? data : []);
      setStudentsByHw({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => buildHistoryTree(lessons), [lessons]);

  const loadStudents = async (hwId: string) => {
    if (studentsByHw[hwId]) return;
    setLoadingStudents(hwId);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${hwId}/students`,
      );
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: Array.isArray(data) ? data : [],
      }));
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
      setStudentsByHw((prev) => ({ ...prev, [hwId]: [] }));
    } finally {
      setLoadingStudents(null);
    }
  };

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
        <button
          onClick={load}
          disabled={loading}
          type="button"
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

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
          subtitle="Sélectionnez une classe pour consulter l'historique des récitations."
        />
      ) : tree.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune récitation enregistrée"
          subtitle="Dès que vous évaluerez des récitations, l'historique apparaîtra ici, organisé par année, trimestre, mois, semaine et jour."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Catalogue des récitations
              <span className="text-xs text-slate-400 font-normal">
                ({lessons.length} leçon(s))
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Naviguez dans l'arborescence : Année → Trimestre → Mois → Semaine → Jour.
            </p>
          </div>
          <div className="p-2 max-h-[70vh] overflow-y-auto">
            {tree.map((yearNode) => (
              <TreeFolder
                key={yearNode.key}
                node={yearNode}
                level={0}
                studentsByHw={studentsByHw}
                loadingStudents={loadingStudents}
                onLoadStudents={loadStudents}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TREE FOLDER — composant récursif
// ============================================================================

interface TreeNode {
  key: string;
  label: string;
  meta?: string;
  level: 'year' | 'trimestre' | 'month' | 'week' | 'day' | 'lesson';
  children?: TreeNode[];
  lessons?: any[]; // pour level=day
}

function TreeFolder({
  node,
  level,
  studentsByHw,
  loadingStudents,
  onLoadStudents,
}: {
  node: TreeNode;
  level: number;
  studentsByHw: Record<string, any[]>;
  loadingStudents: string | null;
  onLoadStudents: (hwId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(level < 2); // year + trimestre ouverts
  const [openHwId, setOpenHwId] = useState<string | null>(null);

  const isLessonLevel = node.level === 'day';
  const childCount = node.children?.length || 0;
  const lessonCount = node.lessons?.length || 0;
  const hasChildren = childCount > 0 || lessonCount > 0;

  const iconColorByLevel: Record<string, string> = {
    year: 'text-slate-700',
    trimestre: 'text-slate-600',
    month: 'text-slate-600',
    week: 'text-slate-500',
    day: 'text-emerald-600',
  };

  return (
    <div className="select-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left',
          level === 0 && 'font-bold',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {open && hasChildren ? (
          <FolderOpen className={cn('w-4 h-4 flex-shrink-0', iconColorByLevel[node.level])} />
        ) : (
          <Folder className={cn('w-4 h-4 flex-shrink-0', iconColorByLevel[node.level])} />
        )}
        <span className={cn(
          'text-sm',
          node.level === 'year' && 'font-bold text-slate-900',
          node.level === 'trimestre' && 'font-semibold text-slate-800',
          node.level === 'month' && 'font-medium text-slate-700',
          node.level === 'week' && 'text-slate-600',
          node.level === 'day' && 'font-semibold text-slate-800',
        )}>
          {node.label}
        </span>
        {node.meta && (
          <span className="text-[10px] text-slate-400 ml-1">{node.meta}</span>
        )}
        {childCount > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {childCount}
          </span>
        )}
      </button>

      {open && hasChildren && (
        <div className="mt-0.5">
          {node.children?.map((child) => (
            <TreeFolder
              key={child.key}
              node={child}
              level={level + 1}
              studentsByHw={studentsByHw}
              loadingStudents={loadingStudents}
              onLoadStudents={onLoadStudents}
            />
          ))}

          {isLessonLevel && node.lessons && node.lessons.length > 0 && (
            <div className="mt-1 space-y-1.5" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
              {node.lessons.map((hw) => {
                const isOpenHw = openHwId === hw.id;
                const students = studentsByHw[hw.id] || [];
                const isLoading = loadingStudents === hw.id;
                return (
                  <div
                    key={hw.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (isOpenHw) {
                          setOpenHwId(null);
                        } else {
                          setOpenHwId(hw.id);
                          if (!studentsByHw[hw.id]) {
                            await onLoadStudents(hw.id);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpenHw ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {hw.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {hw.subject?.name || 'Matière générale'}
                          </p>
                        </div>
                      </div>
                      {students.length > 0 && (
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <HistoryRecitationBadge
                            count={students.filter((s: any) => s.status === 'RECITED').length}
                            color="emerald"
                            label="Réussies"
                          />
                          <HistoryRecitationBadge
                            count={students.filter((s: any) => s.status === 'NOT_RECITED').length}
                            color="rose"
                            label="Échouées"
                          />
                          <HistoryRecitationBadge
                            count={students.filter((s: any) => s.status === 'PENDING' || !s.status).length}
                            color="slate"
                            label="Non éval."
                          />
                        </div>
                      )}
                    </button>

                    {isOpenHw && (
                      <div className="border-t border-slate-100">
                        {isLoading ? (
                          <div className="px-4 py-4 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            Chargement…
                          </div>
                        ) : students.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-slate-400 text-center">
                            Aucun élève dans cette classe.
                          </p>
                        ) : (
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <th className="px-3 py-2">Élève</th>
                                <th className="px-3 py-2">Récitation</th>
                                <th className="px-3 py-2">Note</th>
                                <th className="px-3 py-2">Appréciation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {students.map((s: any) => {
                                const status = s.status || 'PENDING';
                                const opt = RECITATION_OPTIONS.find((o) => o.value === status) ||
                                  RECITATION_OPTIONS[2];
                                const cls = COLOR_CLASSES[opt.color];
                                const Icon = opt.icon;
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2">
                                      <p className="text-xs font-semibold text-slate-900">
                                        {s.student?.lastName || s.lastName || '—'}{' '}
                                        {s.student?.firstName || s.firstName || ''}
                                      </p>
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                                          cls.badge,
                                        )}
                                      >
                                        <Icon className="w-2.5 h-2.5" />
                                        {opt.label}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700">
                                      {s.score != null ? (
                                        <span className="font-bold">
                                          {s.score}/{hw.maxScore || 20}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">Non noté</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                      {s.appreciation || (
                                        <span className="text-slate-400 italic">—</span>
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
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================

function HistoryRecitationBadge({
  count,
  color,
  label,
}: {
  count: number;
  color: string;
  label: string;
}) {
  const cls = COLOR_CLASSES[color] || COLOR_CLASSES.slate;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
        cls.badge,
      )}
      title={label}
    >
      <Award className="w-2.5 h-2.5" />
      {count}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  valueDisplay,
  color,
  bg,
}: {
  label: string;
  value?: number;
  valueDisplay?: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200">
      <div
        className={cn(
          'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1.5',
          bg,
          color,
        )}
      >
        {label}
      </div>
      <p className="text-xl font-bold text-slate-900">
        {valueDisplay !== undefined ? valueDisplay : value}
      </p>
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
        <p className="text-xs text-slate-400 mt-1 max-w-md">{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS — construction de l'arbre historique
// ============================================================================

function getTrimestre(month: number): 1 | 2 | 3 {
  if (month >= 8) return 1;
  if (month <= 2) return 2;
  return 3;
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const offsetToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - offsetToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildHistoryTree(homeworks: any[]): TreeNode[] {
  const byYear = new Map<
    number,
    Map<number, Map<number, Map<string, Map<string, any[]>>>>
  >();

  for (const hw of homeworks) {
    if (!hw.dueDate) continue;
    const d = new Date(hw.dueDate);
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const trim = getTrimestre(d.getMonth());
    const month = d.getMonth();
    const weekStart = getWeekStart(d);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!byYear.has(year)) byYear.set(year, new Map());
    const yMap = byYear.get(year)!;
    if (!yMap.has(trim)) yMap.set(trim, new Map());
    const tMap = yMap.get(trim)!;
    if (!tMap.has(month)) tMap.set(month, new Map());
    const mMap = tMap.get(month)!;
    if (!mMap.has(weekKey)) mMap.set(weekKey, new Map());
    const wMap = mMap.get(weekKey)!;
    if (!wMap.has(dayKey)) wMap.set(dayKey, []);
    wMap.get(dayKey)!.push(hw);
  }

  const tree: TreeNode[] = [];
  for (const [year, tMap] of byYear) {
    const tChildren: TreeNode[] = [];
    for (const [trim, mMap] of tMap) {
      const mChildren: TreeNode[] = [];
      for (const [month, wMap] of mMap) {
        const wChildren: TreeNode[] = [];
        for (const [weekKey, dMap] of wMap) {
          const dChildren: TreeNode[] = [];
          for (const [dayKey, lessons] of dMap) {
            dChildren.push({
              key: `${year}-${trim}-${month}-${weekKey}-${dayKey}`,
              label: formatDateFR(dayKey),
              level: 'day',
              children: [],
              lessons: lessons.sort(
                (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
              ),
            });
          }
          dChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
          const ws = new Date(weekKey);
          const we = new Date(ws);
          we.setDate(ws.getDate() + 6);
          wChildren.push({
            key: `${year}-${trim}-${month}-${weekKey}`,
            label: `Semaine du ${formatDateFR(weekKey)} au ${formatDateFR(we.toISOString())}`,
            level: 'week',
            children: dChildren,
          });
        }
        wChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
        mChildren.push({
          key: `${year}-${trim}-${month}`,
          label: MONTHS_FR[month],
          level: 'month',
          children: wChildren,
        });
      }
      mChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
      tChildren.push({
        key: `${year}-${trim}`,
        label: `Trimestre ${trim}`,
        level: 'trimestre',
        children: mChildren,
      });
    }
    tChildren.sort((a, b) => {
      const at = parseInt(a.key.split('-')[1]);
      const bt = parseInt(b.key.split('-')[1]);
      return at - bt;
    });
    tree.push({
      key: String(year),
      label: `Année ${year}`,
      level: 'year',
      children: tChildren,
    });
  }

  tree.sort((a, b) => Number(b.key) - Number(a.key));
  return tree;
}
