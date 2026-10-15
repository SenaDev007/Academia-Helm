'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — ÉVALUATIONS, NOTES & BULLETINS
 * ============================================================================
 *
 * Le cycle complet de l'enseignant autonome :
 *   1. Créer une évaluation (classe, matière, type, période)
 *   2. Saisir les notes (GradingSheet — composant existant réutilisé)
 *   3. Générer les bulletins de la classe (moyennes calculées automatiquement)
 *
 * Endpoints : les routes /institutional-exams/* existantes fonctionnent telles
 * quelles (PermissionsGuard : bypass enseignant pour exams.read/exams.manage).
 * Référentiel (types + périodes) : GET /teacher-portal/evaluation-types.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Plus,
  X,
  ArrowLeft,
  Calculator,
  FileText,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { GradingSheet } from '@/components/exams/GradingSheet';
import type {
  GroupedEvaluation,
  Evaluation as GradingSheetEvaluation,
} from '@/components/exams/GradingSheet';

interface MyClass {
  classId: string;
  className: string;
  schoolLevelName: string;
  schoolLevelCode?: string;
  subjects: Array<{ subjectId: string; subjectName: string }>;
}

/** Évaluation enrichie (champ école en plus) pour l'affichage liste. */
interface ProfEvaluation extends GradingSheetEvaluation {
  class?: { id: string; name: string; schoolLevel?: { code: string; name: string } };
}

interface EvalTypeOption {
  id: string;
  name: string;
  code: string;
  defaultMaxScore: number;
  defaultCoefficient: number;
  schoolLevel: { id: string; code: string; name: string } | null;
}

interface PeriodOption {
  id: string;
  name: string;
  type: string;
  periodOrder: number;
  isActive: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifiée',
  OPEN_FOR_GRADING: 'Saisie ouverte',
  SUBMITTED: 'Saisie soumise',
  VALIDATED: 'Validée',
  LOCKED: 'Verrouillée',
  CANCELLED: 'Annulée',
  DRAFT: 'Brouillon',
};

export default function ProfExamensPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const [classes, setClasses] = useState<MyClass[]>([]);
  const [evaluations, setEvaluations] = useState<ProfEvaluation[]>([]);
  const [evalTypes, setEvalTypes] = useState<EvalTypeOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    evaluationTypeId: '',
    periodId: '',
    title: '',
    evaluationDate: new Date().toISOString().slice(0, 10),
    maxScore: 20,
    coefficient: 1,
  });

  const [activeGroup, setActiveGroup] = useState<GroupedEvaluation | null>(null);
  const [bulletinsBusy, setBulletinsBusy] = useState<string | null>(null);
  const [bulletinsMessage, setBulletinsMessage] = useState<string | null>(null);

  const teacherId = user?.teacherId || user?.id || '';

  // ── Chargement initial ──
  const loadAll = useCallback(async () => {
    if (!academicYear?.id || !teacherId) return;
    setLoading(true);
    try {
      const [classesRes, evalsRes, typesRes] = await Promise.all([
        fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYear.id}&language=FR`,
          { credentials: 'include' },
        ),
        apiClient.get('/institutional-exams/evaluations', {
          params: { academicYearId: academicYear.id, teacherId },
          timeout: 20000,
        }),
        apiClient.get('/teacher-portal/evaluation-types', { timeout: 15000 }),
      ]);

      const classesData = await classesRes.json();
      setClasses(Array.isArray(classesData) ? classesData : []);
      setEvaluations(Array.isArray(evalsRes.data) ? evalsRes.data : evalsRes.data?.evaluations || []);
      setEvalTypes(typesRes.data?.evaluationTypes || []);
      setPeriods(typesRes.data?.periods || []);

      setForm((prev) => ({
        ...prev,
        classId: prev.classId || (Array.isArray(classesData) && classesData[0]?.classId) || '',
        subjectId:
          prev.subjectId ||
          (Array.isArray(classesData) && classesData[0]?.subjects?.[0]?.subjectId) ||
          '',
        evaluationTypeId:
          prev.evaluationTypeId || (typesRes.data?.evaluationTypes?.[0]?.id ?? ''),
        periodId: prev.periodId || (typesRes.data?.periods?.[0]?.id ?? ''),
      }));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Impossible de charger le module évaluations.');
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, teacherId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Groupe d'évaluations sélectionnable ──
  const groups: GroupedEvaluation[] = useMemo(() => {
    const map = new Map<string, GroupedEvaluation>();
    for (const evaluation of evaluations) {
      if (!evaluation.class?.id) continue;
      const key = `${evaluation.class.id}|${evaluation.evaluationType?.id ?? 'NA'}|${evaluation.period?.id ?? 'NA'}`;
      const existing = map.get(key);
      if (existing) {
        existing.evaluationIds.push(evaluation.id);
        existing.statuses.push(evaluation.status);
        if (
          evaluation.subject?.id &&
          !existing.subjects.some((s) => s.id === evaluation.subject!.id)
        ) {
          existing.subjects.push({ id: evaluation.subject.id, name: evaluation.subject.name });
        }
      } else {
        map.set(key, {
          classId: evaluation.class.id,
          className: evaluation.class.name,
          evaluationTypeId: evaluation.evaluationType?.id ?? '',
          evaluationTypeName: evaluation.evaluationType?.name ?? 'Évaluation',
          evaluationTypeCode: evaluation.evaluationType?.code,
          periodId: evaluation.period?.id ?? '',
          periodName: evaluation.period?.name ?? '',
          startDate: evaluation.startDate ?? evaluation.evaluationDate ?? null,
          endDate: evaluation.endDate ?? null,
          subjects: evaluation.subject?.id
            ? [{ id: evaluation.subject.id, name: evaluation.subject.name }]
            : [],
          evaluationIds: [evaluation.id],
          statuses: [evaluation.status],
          firstEvaluation: evaluation,
        });
      }
    }
    return Array.from(map.values());
  }, [evaluations]);

  // ── Création d'une évaluation ──
  const createEvaluation = async () => {
    if (formSubmitting) return;
    if (!form.classId || !form.subjectId || !form.evaluationTypeId || !form.periodId) {
      setError('Classe, matière, type et période sont requis.');
      return;
    }
    setFormSubmitting(true);
    setError(null);
    try {
      await apiClient.post(
        '/institutional-exams/evaluations',
        {
          classId: form.classId,
          subjectId: form.subjectId,
          evaluationTypeId: form.evaluationTypeId,
          periodId: form.periodId,
          title: form.title.trim() || undefined,
          evaluationDate: form.evaluationDate,
          maxScore: Number(form.maxScore) || 20,
          coefficient: Number(form.coefficient) || 1,
          teacherId,
          language: 'FR',
        },
        { timeout: 20000 },
      );
      setShowForm(false);
      setForm((prev) => ({ ...prev, title: '' }));
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Échec de la création de l’évaluation.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Génération des bulletins ──
  const generateBulletins = async (classId: string, periodId: string, className: string) => {
    if (!periodId || bulletinsBusy) return;
    setBulletinsBusy(classId);
    setBulletinsMessage(null);
    try {
      await apiClient.post(
        `/institutional-exams/bulletins/class/${classId}/generate`,
        { periodId },
        { timeout: 60000 },
      );
      setBulletinsMessage(
        `Bulletins de ${className} générés — moyennes calculées et classements établis. Ils sont prêts pour l'impression.`,
      );
    } catch (e: any) {
      setBulletinsMessage(
        e?.response?.data?.message || 'Échec de la génération des bulletins (des notes manquent ?).',
      );
    } finally {
      setBulletinsBusy(null);
    }
  };

  const selectedClass = classes.find((c) => c.classId === form.classId);
  const activeClassLevelCode = classes.find(
    (c) => c.classId === activeGroup?.classId,
  )?.schoolLevelCode;

  if (!academicYear?.id || loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement du module évaluations…
      </div>
    );
  }

  // ── Vue saisie des notes (GradingSheet) ──
  if (activeGroup) {
    const levelCode = (activeClassLevelCode || '').toUpperCase();
    return (
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => setActiveGroup(null)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux évaluations
        </button>
        <GradingSheet
          group={activeGroup}
          isMaternelle={levelCode.includes('MATERN')}
          isPrimaire={levelCode.includes('PRIMA')}
          isSecondaire={levelCode.includes('SECOND')}
          scopedSubModules={null}
          onBack={() => setActiveGroup(null)}
          language="FR"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Évaluations, notes & bulletins</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez vos évaluations, saisissez les notes — les moyennes et bulletins se calculent
            automatiquement.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            disabled={classes.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Fermer' : 'Nouvelle évaluation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {bulletinsMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {bulletinsMessage}
        </div>
      )}

      {/* ── Formulaire nouvelle évaluation ── */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Calculator className="h-4 w-4 text-teal-600" />
            Nouvelle évaluation
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Classe</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                value={form.classId}
                onChange={(e) => {
                  const classId = e.target.value;
                  const cls = classes.find((c) => c.classId === classId);
                  setForm({
                    ...form,
                    classId,
                    subjectId: cls?.subjects?.[0]?.subjectId || '',
                  });
                }}
              >
                {classes.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.className}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Matière</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                {(selectedClass?.subjects || []).map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                value={form.evaluationTypeId}
                onChange={(e) => {
                  const type = evalTypes.find((t) => t.id === e.target.value);
                  setForm({
                    ...form,
                    evaluationTypeId: e.target.value,
                    maxScore: type?.defaultMaxScore ?? 20,
                    coefficient: type?.defaultCoefficient ?? 1,
                  });
                }}
              >
                {evalTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Période</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                value={form.periodId}
                onChange={(e) => setForm({ ...form, periodId: e.target.value })}
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                    {period.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Intitulé (optionnel)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Ex : Devoir n°1 — Leçons 1 à 3"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  value={form.evaluationDate}
                  onChange={(e) => setForm({ ...form, evaluationDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Barème</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Coef.</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  value={form.coefficient}
                  onChange={(e) => setForm({ ...form, coefficient: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={createEvaluation}
              disabled={formSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {formSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              {formSubmitting ? 'Création…' : 'Créer l’évaluation'}
            </button>
          </div>
        </div>
      )}

      {/* ── Liste des évaluations groupées ── */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ClipboardList className="h-4 w-4 text-teal-600" />
            Mes évaluations
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {groups.length} groupe(s)
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Calculator className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Aucune évaluation pour l’instant. Créez votre première évaluation pour saisir des
              notes et générer des bulletins.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((group) => {
              const gradesCount = group.firstEvaluation?._count?.grades ?? 0;
              const hasOpen = group.statuses.includes('OPEN_FOR_GRADING');
              return (
                <div
                  key={`${group.classId}-${group.evaluationTypeId}-${group.periodId}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {group.className} — {group.evaluationTypeName}
                      {group.periodName ? ` (${group.periodName})` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.subjects.length} matière(s) ·{' '}
                      {group.evaluationIds.length} évaluation(s) ·{' '}
                      {STATUS_LABELS[group.statuses[0]] || group.statuses[0]}
                      {gradesCount > 0 ? ` · ${gradesCount} note(s)` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveGroup(group)}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
                        hasOpen
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Calculator className="h-3.5 w-3.5" />
                      Saisir les notes
                    </button>
                    <button
                      onClick={() =>
                        generateBulletins(group.classId, group.periodId, group.className)
                      }
                      disabled={!group.periodId || bulletinsBusy === group.classId}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      title={
                        group.periodId
                          ? 'Génère les bulletins de la classe pour cette période'
                          : 'Période requise'
                      }
                    >
                      {bulletinsBusy === group.classId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      Générer les bulletins
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {groups.length === 0 && classes.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            Activez un niveau dans vos paramètres pour recevoir vos classes et matières.
          </p>
        </div>
      )}
    </div>
  );
}
