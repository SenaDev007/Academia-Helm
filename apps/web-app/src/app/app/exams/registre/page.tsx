'use client';

/**
 * ============================================================================
 * MODULE EXAMENS — REGISTRE DES NOTES (Refonte hiérarchique)
 * ============================================================================
 *
 * Affiche les notes VALIDÉES d'une classe, hiérarchisées par :
 *   Trimestre → Type d'évaluation (EM1, EM2, EC)
 *
 * Flux :
 *   1. L'admin sélectionne une classe (auto-sélection de la première)
 *   2. La liste des évaluations VALIDATED est chargée et groupée par trimestre
 *   3. L'admin clique sur une carte d'évaluation → ouvre le tableau de détails
 *   4. Le tableau est EXACTEMENT le même que celui du Module Examen
 *      (GradingSheet en lecture seule) :
 *      - Maternelle : TS/S/PS (pas de /20, pas de moyenne, appréciation globale)
 *      - Primaire : CM/18, CP/2, Total, Total gén., Rang, Seuil
 *      - Secondaire : Note/20, Total gén., Rang, Seuil
 *
 * ⭐ Pattern identique à la page Validation — reuse de HierarchicalEvaluationList
 *    + même tableau de détails (read-only).
 * ============================================================================
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import {
  Loader2, ClipboardList, ChevronLeft, AlertCircle,
  Users, BookOpen, Lock, CheckCircle2, FileText,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { HierarchicalEvaluationList } from '@/components/exams/HierarchicalEvaluationList';
import type { GroupedEvaluation, GradeRow } from '@/components/exams/GradingSheet';
import { formatRang, computeAppreciationGlobale, getSubjectOrderIndex } from '@/components/exams/GradingSheet';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Pedagogical class ordering ──────────────────────────────────────────────
const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];

const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (const prefix of PEDAGOGICAL_ORDER) {
    if (upper.startsWith(prefix)) return PEDAGOGICAL_ORDER.indexOf(prefix);
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RegistrePage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);

  return (
    <ModuleContainer
      header={{
        title: 'Registre des notes',
        description: 'Récapitulatif de toutes les notes validées par classe et par trimestre.',
        icon: 'clipboardList',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'registre',
      }}
      content={{
        layout: 'full',
        children: (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
            <RegistreContent />
          </Suspense>
        ),
      }}
    />
  );
}

// ─── Content (client component with useSearchParams) ────────────────────────

function RegistreContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvaluation | null>(null);

  const language = scopeLang || 'FR';
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

  // ── Load classes (with pedagogical sort + auto-select first) ──────────────
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      const res = await fetch('/api/all-classes', { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);
      const levelClasses = allClasses.filter((c: any) =>
        c.schoolLevelId === schoolLevelUuid || c.schoolLevel?.id === schoolLevelUuid
      );
      const langClasses = language
        ? levelClasses.filter((c: any) => {
            const classLang = c.language;
            const trackCode = c.academicTrack?.code || c.academicTrackCode;
            if (!classLang && !trackCode) return true;
            if (classLang === language) return true;
            if (trackCode === language) return true;
            return false;
          })
        : levelClasses;
      langClasses.sort((a: any, b: any) => {
        const idxA = pedagogicalSortIndex(a.name);
        const idxB = pedagogicalSortIndex(b.name);
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '', 'fr');
      });
      setClasses(langClasses);
      if (langClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(langClasses[0].id);
      }
    } catch {
      setClasses([]);
    }
  }, [schoolLevelUuid, language, selectedClassId]);

  // ── Load VALIDATED evaluations for the selected class ─────────────────────
  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id || !selectedClassId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await institutionalExamsService.getEvaluations({
        academicYearId: academicYear.id,
        classId: selectedClassId,
        status: 'VALIDATED',
      });
      setEvaluations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading evaluations for registre', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClassId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ── Group evaluations by (classId × evaluationTypeId × periodId × dates) ─
  const grouped = useMemo<GroupedEvaluation[]>(() => {
    const map = new Map<string, GroupedEvaluation>();
    for (const ev of evaluations) {
      const classId = ev.class?.id || selectedClassId;
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
          startDate: ev.startDate || ev.evaluationDate || null,
          endDate: ev.endDate || ev.startDate || ev.evaluationDate || null,
          subjects: [],
          evaluationIds: [],
          statuses: [],
          firstEvaluation: ev as any,
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values());
  }, [evaluations, selectedClassId]);

  // ── Render: detail sheet if selected, else list ───────────────────────────
  if (selectedGroup) {
    return (
      <RegistreDetailSheet
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

  return (
    <div className="space-y-4">
      {/* Header + class selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Registre des notes</h2>
          <Badge variant="outline" className="text-xs">
            {scopeLevel || '—'} {language ? `· ${language}` : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          Sélectionnez une évaluation ci-dessous pour consulter son registre des notes.
          Seules les évaluations <strong>VALIDATED</strong> sont affichées (notes verrouillées par l'administration).
        </div>
      </div>

      {/* Content */}
      {!selectedClassId ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-gray-500">Sélectionnez une classe pour afficher le registre</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Chargement du registre...</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-gray-500">Aucune note validée pour cette classe</p>
          <p className="text-xs mt-1 text-gray-400">
            Les notes apparaîtront ici une fois validées dans l'onglet « Validation ».
          </p>
        </div>
      ) : (
        <HierarchicalEvaluationList
          groups={grouped}
          onGroupClick={(g) => setSelectedGroup(g)}
          isMaternelle={isMaternelle}
          renderStatusBadge={(g) => (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700">
              Validé
            </span>
          )}
        />
      )}
    </div>
  );
}

// ─── Detail Sheet (read-only — same table as GradingSheet/Validation) ───────

function RegistreDetailSheet({
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

  const sortedSubjects = useMemo(() => {
    return [...group.subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [group.subjects, isMaternelle, isPrimaire]);

  // ── Load students + grades ──────────────────────────────────────────────────
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
        console.error('Error loading registre sheet', err);
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

      const hasScore = sortedSubjects.some((subj) => {
        const s = row.scores[subj.id];
        if (!s || s.isAbsent) return false;
        return isMaternelle ? !!s.qualitativeCode : (s.cm !== null || s.score !== null);
      });
      if (hasScore) {
        if (isBoy) composedBoys++;
        if (isGirl) composedGirls++;
      }

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
    <ModuleContainer
      subModules={{ modules: scopedSubModules, activeModuleId: 'registre' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Titre */}
            <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
              <h2 className="text-lg font-bold text-slate-900">
                REGISTRE DES NOTES — {group.evaluationTypeName}
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
                <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {rows.length} élèves
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <BookOpen className="w-3 h-3" />
                  {group.subjects.length} matières
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Validé
                </Badge>
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
                  Registre des notes validées — lecture seule
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                      {sortedSubjects.map((subject, idx) => (
                        isMaternelle ? (
                          <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                            {subject.name}<div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                          </th>
                        ) : isSecondaire ? (
                          <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
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
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil fixé</th>
                      <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Seuil atteint</th>
                      {isMaternelle && (
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation globale</th>
                      )}
                    </tr>
                    {!isSecondaire && !isMaternelle && (
                      <tr className="bg-slate-50">
                        {sortedSubjects.map((_, idx) => (
                          <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                        ))}
                        {sortedSubjects.map((_, idx) => (
                          <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                        ))}
                        {sortedSubjects.map((_, idx) => (
                          <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                        ))}
                        <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                        <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
                      </tr>
                    )}
                    {isMaternelle && (
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                        <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
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
                      const seuilAtteint = isMaternelle ? null : (
                        totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length * 0.5)
                      );

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
                          {/* Seuil fixé */}
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 text-xs">
                            {isMaternelle ? 'TS/S' : '10/20'}
                          </td>
                          {/* Seuil atteint */}
                          <td className="border border-slate-300 px-2 py-1 text-center">
                            {(() => {
                              if (isMaternelle) {
                                const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                                return (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') ?
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : null;
                              }
                              return seuilAtteint ?
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : null;
                            })()}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center">
                            {(() => {
                              if (isMaternelle) {
                                const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                                return (appreciation !== 'Très Satisfaisant' && appreciation !== 'Satisfaisant') ?
                                  <span className="text-red-500 text-xs">✗</span> : null;
                              }
                              return !seuilAtteint ?
                                <span className="text-red-500 text-xs">✗</span> : null;
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
  );
}
