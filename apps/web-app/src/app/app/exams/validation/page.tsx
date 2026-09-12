/**
 * ============================================================================
 * MODULE EXAMENS — VALIDATION (Refonte avec hiérarchisation par trimestre)
 * ============================================================================
 *
 * Vue hiérarchique : Trimestre → Évaluations soumises → Tableau de détails
 *
 * - Liste les évaluations avec statut SUBMITTED (soumises pour validation)
 * - Groupées par trimestre (HierarchicalEvaluationList)
 * - Cliquer sur une carte → ouvre le tableau de détails (GradingSheet en readonly)
 *   + boutons valider/rejeter par élève
 *   + bouton global valider/rejeter
 * - Stats récapitulatives dynamiques
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle, XCircle, Loader2, RefreshCw,
  Users, BookOpen, ChevronLeft, AlertCircle, Lock,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { HierarchicalEvaluationList } from '@/components/exams/HierarchicalEvaluationList';
import type { GroupedEvaluation, GradeRow } from '@/components/exams/GradingSheet';
import { formatRang, computeAppreciationGlobale, getSubjectOrderIndex } from '@/components/exams/GradingSheet';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  class?: { id: string; name: string };
  subject?: { id: string; name: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

// ─── Page Principale ──────────────────────────────────────────────────────────

export default function ValidationPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvaluation | null>(null);

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;
  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isPrimaire = scopeLevel === 'PRIMAIRE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  // ── Charger les évaluations avec statut SUBMITTED ──────────────────────────
  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        academicYearId: academicYear.id,
        status: 'SUBMITTED',
      };
      if (schoolLevelUuid && schoolLevelUuid !== 'ALL') params.schoolLevelId = schoolLevelUuid;
      if (scopeLang) params.language = scopeLang;
      const res = await institutionalExamsService.getEvaluations(params);
      setEvaluations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading evaluations for validation', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ── Grouper par (classId × evaluationTypeId × periodId × dates) ────────────
  const grouped = useMemo<GroupedEvaluation[]>(() => {
    const map = new Map<string, GroupedEvaluation>();
    for (const ev of evaluations) {
      const classId = ev.class?.id || '_no_class';
      const evaluationTypeId = ev.evaluationType?.id || '_no_type';
      const periodId = ev.period?.id || '_no_period';
      const sd = ev.startDate || ev.evaluationDate || '';
      const ed = ev.endDate || ev.startDate || ev.evaluationDate || '';
      const key = `${classId}|${evaluationTypeId}|${periodId}|${sd}|${ed}`;

      if (!map.has(key)) {
        map.set(key, {
          classId,
          className: ev.class?.name || 'Sans classe',
          evaluationTypeId,
          evaluationTypeName: ev.evaluationType?.name || 'Évaluation',
          evaluationTypeCode: ev.evaluationType?.code,
          periodId,
          periodName: ev.period?.name || '',
          startDate: ev.startDate || null,
          endDate: ev.endDate || null,
          subjects: [],
          evaluationIds: [],
          statuses: [],
          firstEvaluation: ev as any,
          subjectByEvalId: {},
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      // ⭐ V10d — mapping explicite evaluationId → subjectId (robuste aux doublons)
      if (ev.subject) (g as any).subjectByEvalId![ev.id] = ev.subject.id;
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values());
  }, [evaluations]);

  if (selectedGroup) {
    return (
      <ValidationDetailSheet
        group={selectedGroup}
        isMaternelle={isMaternelle}
        isPrimaire={isPrimaire}
        isSecondaire={isSecondaire}
        scopedSubModules={scopedSubModules}
        onBack={() => {
          setSelectedGroup(null);
          loadEvaluations();
        }}
      />
    );
  }

  // ─── Vue liste hiérarchique ──────────────────────────────────────────────────
  return (
    <ModuleContainer
      subModules={{ modules: scopedSubModules, activeModuleId: 'validation' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-900">Validation des notes</h4>
                <p className="text-xs text-blue-700">
                  Une fois validée, une évaluation ne peut plus être modifiée par l'enseignant
                  sans une demande de déverrouillage formelle.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadEvaluations} disabled={loading} className="ml-auto">
                <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                Actualiser
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">Chargement des évaluations à valider…</span>
              </div>
            ) : grouped.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucune évaluation en attente de validation</p>
                <p className="text-sm text-gray-400 mt-1">
                  Les évaluations soumises par les enseignants apparaîtront ici.
                </p>
              </div>
            ) : (
              <HierarchicalEvaluationList
                groups={grouped}
                onGroupClick={(g) => setSelectedGroup(g)}
                isMaternelle={isMaternelle}
                scopeKey="validation"
                renderStatusBadge={(g) => (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap bg-amber-100 text-amber-700">
                    À valider
                  </span>
                )}
              />
            )}
          </div>
        ),
      }}
    />
  );
}

// ─── Tableau de détails (Validation) ──────────────────────────────────────────

function ValidationDetailSheet({
  group,
  isMaternelle,
  isPrimaire,
  isSecondaire,
  scopedSubModules,
  onBack,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  isSecondaire: boolean;
  scopedSubModules: any;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const { warning, danger, dialog: confirmDialog } = useConfirmDialog();

  const sortedSubjects = useMemo(() => {
    return [...group.subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [group.subjects, isMaternelle, isPrimaire]);

  // ── Charger les élèves + notes ──────────────────────────────────────────────
  useEffect(() => {
    const loadSheet = async () => {
      if (!group.evaluationIds.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sheets = await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              const response = await apiClient.get(`/institutional-exams/grades/evaluation/${evId}`);
              return { evaluationId: evId, students: Array.isArray(response.data) ? response.data : [] };
            } catch {
              return { evaluationId: evId, students: [] };
            }
          })
        );

        const evalToSubject = new Map<string, string>();
        group.evaluationIds.forEach((evId, idx) => {
          const subjectId = group.subjects[idx]?.id;
          if (subjectId) evalToSubject.set(evId, subjectId);
        });

        const studentMap = new Map<string, GradeRow>();
        sheets.forEach(({ evaluationId, students }) => {
          const subjectId = evalToSubject.get(evaluationId);
          if (!subjectId) return;
          students.forEach((student: any) => {
            if (!studentMap.has(student.studentId)) {
              studentMap.set(student.studentId, {
                studentId: student.studentId,
                studentName: student.studentName || 'Inconnu',
                matricule: student.matricule,
                gender: student.gender,
                scores: {},
                status: student.status || 'NEW',
              });
            }
            const row = studentMap.get(student.studentId)!;
            row.scores[subjectId] = {
              score: student.score ?? null,
              cm: student.cm ?? null,
              cp: student.cp ?? null,
              qualitativeCode: student.qualitativeCode ?? null,
              isAbsent: student.isAbsent ?? false,
              comment: student.comment ?? '',
            };
          });
        });

        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            if (!row.scores[subject.id]) {
              row.scores[subject.id] = { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            }
          });
        });
        rowsArray.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
        setRows(rowsArray);
      } catch (err) {
        console.error('Error loading validation sheet', err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    loadSheet();
  }, [group]);

  // ── Stats récapitulatives ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalBoys = 0, totalGirls = 0;
    let composedBoys = 0, composedGirls = 0;
    let reachedBoys = 0, reachedGirls = 0;

    rows.forEach((row) => {
      const isBoy = row.gender === 'M';
      const isGirl = row.gender === 'F';
      if (isBoy) totalBoys++;
      if (isGirl) totalGirls++;

      // Composé = au moins une note saisie (pas absent)
      const hasScore = sortedSubjects.some((subj) => {
        const s = row.scores[subj.id];
        if (!s || s.isAbsent) return false;
        return isMaternelle ? !!s.qualitativeCode : (s.cm !== null || s.score !== null);
      });
      if (hasScore) {
        if (isBoy) composedBoys++;
        if (isGirl) composedGirls++;
      }

      // Seuil atteint
      if (isMaternelle) {
        const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
        if (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') {
          if (isBoy) reachedBoys++;
          if (isGirl) reachedGirls++;
        }
      } else {
        const totalGeneral = sortedSubjects.reduce((sum, subj) => {
          const s = row.scores[subj.id];
          return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
        }, 0);
        if (totalGeneral >= (10 * sortedSubjects.length * 0.5)) {
          if (isBoy) reachedBoys++;
          if (isGirl) reachedGirls++;
        }
      }
    });

    const total = totalBoys + totalGirls;
    const composed = composedBoys + composedGirls;
    const reached = reachedBoys + reachedGirls;
    const notReached = composed - reached;
    const pctReussite = composed > 0 ? (reached / composed) * 100 : 0;

    return {
      totalBoys, totalGirls, total,
      composedBoys, composedGirls, composed,
      reachedBoys, reachedGirls, reached,
      notReachedBoys: composedBoys - reachedBoys,
      notReachedGirls: composedGirls - reachedGirls,
      notReached,
      pctReussite,
    };
  }, [rows, sortedSubjects, isMaternelle]);

  // ── Valider toutes les évaluations du groupe ────────────────────────────────
  const handleApproveAll = async () => {
    const ok = await warning(
      `Valider définitivement les notes de ${group.className} — ${group.evaluationTypeName} ?\n\n` +
      `${rows.length} élève(s) · ${group.subjects.length} matière(s)\n\n` +
      `⚠️ Cette action verrouillera les notes de manière permanente. L'enseignant ne pourra plus les modifier sans demande de déverrouillage.`,
      'Validation définitive',
      'Cette action est irréversible.'
    );
    if (!ok) return;

    setApprovingAll(true);
    try {
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          try {
            await apiClient.patch(`/institutional-exams/evaluations/${evId}/validate`);
          } catch (err: any) {
            console.error(`Failed to validate evaluation ${evId}:`, err.response?.data || err.message);
          }
        })
      );
      toastSuccess('Notes validées et verrouillées', {
        description: `${rows.length} élève(s) · ${group.subjects.length} matière(s)`,
      });
      onBack();
    } catch (err: any) {
      toastError('Erreur lors de la validation', { description: err.message });
    } finally {
      setApprovingAll(false);
    }
  };

  // ── Rejeter toutes les évaluations du groupe ───────────────────────────────
  const handleRejectAll = async () => {
    const reason = prompt('Motif du rejet (obligatoire) :');
    if (!reason || !reason.trim()) return;

    try {
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          try {
            await apiClient.post(`/institutional-exams/evaluations/${evId}/cancel`, { reason: reason.trim() });
          } catch (err: any) {
            console.error(`Failed to reject evaluation ${evId}:`, err.response?.data || err.message);
          }
        })
      );
      toastSuccess('Notes rejetées', {
        description: 'L\'enseignant sera notifié pour correction.',
      });
      onBack();
    } catch (err: any) {
      toastError('Erreur lors du rejet', { description: err.message });
    }
  };

  // ── Rang calculé ────────────────────────────────────────────────────────────
  const getRang = (row: GradeRow) => {
    const sortedByTotal = [...rows]
      .map((r) => ({
        id: r.studentId,
        total: sortedSubjects.reduce((sum, subj) => {
          const s = r.scores[subj.id];
          if (!s || s.isAbsent) return sum;
          if (isMaternelle) {
            if (s.qualitativeCode === 'TS') return sum + 3;
            if (s.qualitativeCode === 'S') return sum + 2;
            if (s.qualitativeCode === 'PS') return sum + 1;
            return sum;
          }
          return sum + (typeof s.score === 'number' ? s.score : 0);
        }, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const rank = sortedByTotal.findIndex((r) => r.id === row.studentId) + 1;
    return rank;
  };

  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  const sameDay = startDate && endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  const dateRange = startDate
    ? sameDay || !endDate
      ? `Le ${format(startDate, 'd MMM yyyy', { locale: fr })}`
      : `Du ${format(startDate, 'd MMM yyyy', { locale: fr })} au ${format(endDate, 'd MMM yyyy', { locale: fr })}`
    : 'Date non définie';

  return (
    <>
      <ModuleContainer
        subModules={{ modules: scopedSubModules, activeModuleId: 'validation' }}
        content={{
          layout: 'full',
          children: (
            <div className="space-y-4">
              {/* Titre */}
              <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
                <h2 className="text-lg font-bold text-slate-900">
                  VALIDATION DES NOTES — {group.evaluationTypeName}
                </h2>
                <div className="text-sm text-slate-600 mt-1">
                  Classe : <strong>{group.className}</strong> • {group.periodName} • {dateRange}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
                <Button variant="ghost" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Retour à la liste
                </Button>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs gap-1">
                    <Users className="w-3 h-3" />
                    {rows.length} élèves
                  </Badge>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                    <BookOpen className="w-3 h-3" />
                    {group.subjects.length} matières
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRejectAll}
                    disabled={approvingAll || loading}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Rejeter
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={approvingAll || loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                  >
                    {approvingAll ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Valider définitivement
                  </Button>
                </div>
              </div>

              {/* Loading */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="ml-3 text-sm text-gray-500">Chargement des notes…</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Aucun élève dans cette classe</p>
                </div>
              ) : (
                /* Tableau en lecture seule (même structure que GradingSheet) */
                <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
                  <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Mode lecture seule — consultez les notes puis validez ou rejetez
                  </div>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                        {sortedSubjects.map((subject, idx) => (
                          isMaternelle ? (
                            <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                              {subject.name}<div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                            </th>
                          ) : isSecondaire ? (
                            <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                              {subject.name}<div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                            </th>
                          ) : (
                            <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">{subject.name}</th>
                          )
                        ))}
                        {!isMaternelle && !isSecondaire && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
                        )}
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil</th>
                        {isMaternelle && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation</th>
                        )}
                      </tr>
                      {!isMaternelle && !isSecondaire && (
                        <tr className="bg-slate-50">
                          {sortedSubjects.map((_, idx) => (
                            <>
                              <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                              <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                              <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                            </>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const totalGeneral = isMaternelle ? null : sortedSubjects.reduce((sum, subj) => {
                          const s = row.scores[subj.id];
                          return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
                        }, 0);
                        const rang = getRang(row);

                        return (
                          <tr key={row.studentId} className={cn('hover:bg-slate-50', idx % 2 === 1 && 'bg-slate-50/50')}>
                            <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                            <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900">{row.studentName}</td>
                            <td className="border border-slate-300 px-2 py-1 text-center">
                              {row.gender === 'M' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                              ) : row.gender === 'F' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                              ) : '—'}
                            </td>
                            {/* Notes en lecture seule */}
                            {sortedSubjects.map((subject) => {
                              const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                              if (isMaternelle) {
                                return (
                                  <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center">
                                    <span className={cn(
                                      'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                                      score.qualitativeCode === 'TS' ? 'bg-emerald-100 text-emerald-700' :
                                      score.qualitativeCode === 'S' ? 'bg-blue-100 text-blue-700' :
                                      score.qualitativeCode === 'PS' ? 'bg-amber-100 text-amber-700' :
                                      'text-slate-300',
                                      score.isAbsent && 'line-through opacity-50'
                                    )}>
                                      {score.isAbsent ? 'ABS' : (score.qualitativeCode || '—')}
                                    </span>
                                  </td>
                                );
                              }
                              if (isSecondaire) {
                                return (
                                  <td key={subject.id} className="border border-slate-300 px-2 py-1 text-center font-bold">
                                    {score.isAbsent ? <span className="text-red-500 text-[10px]">ABS</span> :
                                      (score.score !== null ? Number(score.score).toFixed(2) : '—')}
                                  </td>
                                );
                              }
                              const cmValue = score.cm ?? null;
                              const cpValue = score.cp ?? null;
                              const totalValue = (cmValue !== null ? cmValue : 0) + (cpValue !== null ? cpValue : 0);
                              return (
                                <>
                                  <td key={`cm-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-semibold">
                                    {score.isAbsent ? '—' : (cmValue !== null ? cmValue : '—')}
                                  </td>
                                  <td key={`cp-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-semibold">
                                    {score.isAbsent ? '—' : (cpValue !== null ? cpValue : '—')}
                                  </td>
                                  <td key={`tot-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                                    {score.isAbsent ? '—' : (cmValue !== null || cpValue !== null ? Number(totalValue).toFixed(2) : '—')}
                                  </td>
                                </>
                              );
                            })}
                            {/* Total général */}
                            {!isMaternelle && !isSecondaire && (
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                                {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                              </td>
                            )}
                            {/* Rang */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                              {formatRang(rang, row.gender)}
                            </td>
                            {/* Seuil */}
                            <td className="border border-slate-300 px-2 py-1 text-center">
                              {(() => {
                                if (isMaternelle) {
                                  const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                                  return (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') ?
                                    <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" /> :
                                    <XCircle className="w-4 h-4 text-red-500 mx-auto" />;
                                }
                                return totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length * 0.5) ?
                                  <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" /> :
                                  <XCircle className="w-4 h-4 text-red-500 mx-auto" />;
                              })()}
                            </td>
                            {/* Appréciation (Maternelle) */}
                            {isMaternelle && (
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                                <span className={cn(
                                  'text-xs',
                                  computeAppreciationGlobale(row.scores, sortedSubjects) === 'Très Satisfaisant' && 'text-emerald-600',
                                  computeAppreciationGlobale(row.scores, sortedSubjects) === 'Satisfaisant' && 'text-blue-600',
                                  computeAppreciationGlobale(row.scores, sortedSubjects) === 'Peu Satisfaisant' && 'text-amber-600',
                                )}>
                                  {computeAppreciationGlobale(row.scores, sortedSubjects)}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Récapitulatif dynamique */}
              {!loading && rows.length > 0 && (
                <div className="bg-white border-2 border-slate-300 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Récapitulatif de l'évaluation</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-left">Indicateur</th>
                          <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Garçons</th>
                          <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Filles</th>
                          <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 px-3 py-2 font-semibold">Effectif total de la classe</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{stats.totalBoys}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{stats.totalGirls}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.total}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 px-3 py-2 font-semibold">Nombre d'élèves ayant composé</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{stats.composedBoys}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{stats.composedGirls}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.composed}</td>
                        </tr>
                        <tr className="bg-emerald-50/50">
                          <td className="border border-slate-300 px-3 py-2 font-semibold">Ont atteint le seuil de réussite</td>
                          <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.reachedBoys}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.reachedGirls}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{stats.reached}</td>
                        </tr>
                        <tr className="bg-red-50/50">
                          <td className="border border-slate-300 px-3 py-2 font-semibold">N'ont pas atteint le seuil</td>
                          <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.notReachedBoys}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.notReachedGirls}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-700">{stats.notReached}</td>
                        </tr>
                        <tr className="bg-blue-50/50">
                          <td className="border border-slate-300 px-3 py-2 font-bold">% de réussite</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">
                            {stats.composedBoys > 0 ? ((stats.reachedBoys / stats.composedBoys) * 100).toFixed(2) : '—'}%
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">
                            {stats.composedGirls > 0 ? ((stats.reachedGirls / stats.composedGirls) * 100).toFixed(2) : '—'}%
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-800">
                            {stats.pctReussite.toFixed(2)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          ),
        }}
      />
      {confirmDialog}
    </>
  );
}
