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
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { filterClassesForLevel } from '../level-isolation';
import { HierarchicalEvaluationList } from '@/components/exams/HierarchicalEvaluationList';
import type { GroupedEvaluation, GradeRow } from '@/components/exams/GradingSheet';
import {
  formatRang, computeAppreciationGlobale, getSubjectOrderIndex,
  computeAppreciationSecondaire, appreciationSecondaireClassName,
} from '@/components/exams/GradingSheet';
import { getMaxScoreForType, translatePeriodName } from '@/lib/exam-anglophone-config';
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

// ═══ Helpers — REGISTRE DES NOTES SECONDAIRE ═════════════════════════════════

type SecondaryNoteKey = 'INT1' | 'INT2' | 'DS1' | 'DS2';

/**
 * Détermine si une classe du secondaire est du 1er cycle « junior »
 * (6e / 5e — modèle SANS coefficient) ou « senior » (4e → Terminale —
 * modèle AVEC coefficient + note coefficient).
 */
function isJuniorSecondaryClass(className: string): boolean {
  const m = (className || '').toUpperCase().trim().match(/(\d+)/);
  return !!m && (m[1] === '6' || m[1] === '5');
}

/**
 * Mappe le type d'une évaluation vers sa clé de note secondaire
 * (INT1 / INT2 / DS1 / DS2), par code OU par libellé — les types sont
 * créés par tenant via l'onglet Paramètres (codes INT1/INT2/DS1/DS2
 * observés en production, libellés « Interrogation 1 », etc.).
 */
function secondaryNoteKey(code?: string | null, name?: string | null): SecondaryNoteKey | null {
  const c = (code || '').toUpperCase().trim();
  if (c === 'INT1' || c === 'IE1') return 'INT1';
  if (c === 'INT2' || c === 'IE2') return 'INT2';
  if (c === 'DS1') return 'DS1';
  if (c === 'DS2') return 'DS2';
  const u = (name || '').toUpperCase().trim();
  if (u.includes('INTERROGATION') && u.includes('1')) return 'INT1';
  if (u.includes('INTERROGATION') && u.includes('2')) return 'INT2';
  if (u.includes('DEVOIR SURVEILL') && u.includes('1')) return 'DS1';
  if (u.includes('DEVOIR SURVEILL') && u.includes('2')) return 'DS2';
  return null;
}

/** Formate une note : 15 → « 15 », 12.5 → « 12.5 », null → « — ». */
function fmtNote(n: number | null): string {
  if (n === null || isNaN(n)) return '—';
  return Number(n).toFixed(2).replace(/\.00$/, '').replace(/\.(\d)0$/, '.$1');
}

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
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
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
      // ⭐ V10b — Isolation stricte niveau + piste linguistique (non marqué = FR)
      const langClasses = filterClassesForLevel(allClasses, schoolLevelUuid, language);
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
  }, [evaluations, selectedClassId]);

  // ── Render: detail sheet if selected, else list ───────────────────────────
  if (selectedGroup) {
    return (
      <RegistreDetailSheet
        group={selectedGroup}
        isMaternelle={isMaternelle}
        isPrimaire={isPrimaire}
        isSecondaire={isSecondaire}
        language={language as 'FR' | 'EN'}
        scopedSubModules={scopedSubModules}
        onBack={() => {
          setSelectedGroup(null);
          loadEvaluations();
        }}
      />
    );
  }

  // ⭐ SECONDAIRE — Vue dédiée : une matière × un trimestre, avec le modèle
  // de tableau demandé (6e/5e sans coefficient ; 4e→Terminale avec
  // Coefficient + Note coefficient). Pas de navigation par évaluation.
  if (isSecondaire) {
    return (
      <RegistreSecondaireView
        classes={classes}
        selectedClassId={selectedClassId}
        onSelectClass={setSelectedClassId}
        evaluations={evaluations}
        loading={loading}
        levelBadge={`${scopeLevel || '—'} ${language ? `· ${language}` : ''}`}
        onRefresh={loadEvaluations}
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
          scopeKey="registre"
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

// ═══ REGISTRE DES NOTES — NIVEAU SECONDAIRE ═════════════════════════════════
//
// Modèle demandé (une matière × un trimestre) :
//
//   6e / 5e (1er cycle, SANS coefficient) :
//     N° | Nom et prénom | INTERROGATION [Interrogation écrite 1, 2]
//        | Moyenne d'interrogation | DEVOIR SURVEILLÉ [Devoir surveillé 1, 2]
//        | Moyenne obtenue | Rang | Appréciation | Signature du professeur
//
//   4e → Terminale (AVEC coefficient) :
//     N° | Nom et prénom | INTERROGATION [Interrogation écrite 1, 2]
//        | Moyenne d'interrogation | DEVOIR SURVEILLÉ [Devoir surveillé 1, 2]
//        | Coefficient | Note coefficient | Rang | Appréciation | Signature
//
// Formule officielle (score-entry-schema.service.ts) :
//   Moyenne d'interrogation = (INT1 + INT2) / 2
//   Moyenne obtenue         = (Moy_interros + DS1 + DS2) / 3
// (les notes absentes sont exclues — chaque partie disponible compte pour 1)
// ═══════════════════════════════════════════════════════════════════════════════

interface SecondaryRegRow {
  studentId: string;
  studentName: string;
  gender?: string | null;
  notes: Partial<Record<SecondaryNoteKey, { score: number | null; isAbsent: boolean }>>;
}

function RegistreSecondaireView({
  classes,
  selectedClassId,
  onSelectClass,
  evaluations,
  loading,
  levelBadge,
  onRefresh,
}: {
  classes: any[];
  selectedClassId: string;
  onSelectClass: (id: string) => void;
  evaluations: any[];
  loading: boolean;
  levelBadge: string;
  onRefresh: () => void;
}) {
  // ── Matières disponibles (celles des évaluations VALIDATED de la classe) ──
  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; coefficient: number }>();
    evaluations.forEach((ev) => {
      if (ev.subject && !map.has(ev.subject.id)) {
        map.set(ev.subject.id, {
          id: ev.subject.id,
          name: ev.subject.name,
          coefficient: typeof ev.subject.coefficient === 'number' ? ev.subject.coefficient : 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [evaluations]);

  // ── Trimestres disponibles (triés par numéro) ──────────────────────────────
  const periods = useMemo(() => {
    const map = new Map<string, { id: string; name: string; number: number }>();
    evaluations.forEach((ev) => {
      if (ev.period && !map.has(ev.period.id)) {
        const num = parseInt((ev.period.name || '').match(/(\d+)/)?.[1] || '99', 10);
        map.set(ev.period.id, { id: ev.period.id, name: ev.period.name, number: num });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [evaluations]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  // Auto-sélection (et garde-fou si la sélection disparaît)
  useEffect(() => {
    if (!subjects.find((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0]?.id || '');
    }
  }, [subjects, selectedSubjectId]);
  useEffect(() => {
    if (!periods.find((p) => p.id === selectedPeriodId)) {
      setSelectedPeriodId(periods[0]?.id || '');
    }
  }, [periods, selectedPeriodId]);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || null;
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) || null;
  const selectedClassName = classes.find((c: any) => c.id === selectedClassId)?.name || '';
  const isJunior = isJuniorSecondaryClass(selectedClassName);

  // ── Les 4 évaluations typées (INT1/INT2/DS1/DS2) de la matière + trimestre ──
  const typedEvaluations = useMemo<Record<SecondaryNoteKey, any | null>>(() => {
    const map: Record<SecondaryNoteKey, any | null> = { INT1: null, INT2: null, DS1: null, DS2: null };
    evaluations
      .filter((ev) => ev.subject?.id === selectedSubjectId && ev.period?.id === selectedPeriodId)
      .forEach((ev) => {
        const key = secondaryNoteKey(ev.evaluationType?.code, ev.evaluationType?.name);
        if (key && !map[key]) map[key] = ev; // la liste est triée desc : la plus récente gagne
      });
    return map;
  }, [evaluations, selectedSubjectId, selectedPeriodId]);

  const hasAnyTypedEvaluation = useMemo(
    () => Object.values(typedEvaluations).some(Boolean),
    [typedEvaluations],
  );

  // ── Élèves + notes (une requête par évaluation typée) ─────────────────────
  const [rows, setRows] = useState<SecondaryRegRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    const entries = (Object.entries(typedEvaluations) as Array<[SecondaryNoteKey, any | null]>)
      .filter(([, ev]) => !!ev);
    if (entries.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setSheetLoading(true);
    (async () => {
      try {
        const sheets = await Promise.all(entries.map(async ([key, ev]) => {
          try {
            const response = await apiClient.get(`/institutional-exams/grades/evaluation/${ev.id}`);
            return { key, students: Array.isArray(response.data) ? response.data : [] };
          } catch {
            return { key, students: [] as any[] };
          }
        }));
        if (cancelled) return;
        const studentMap = new Map<string, SecondaryRegRow>();
        sheets.forEach(({ key, students }) => {
          students.forEach((student: any) => {
            if (!studentMap.has(student.studentId)) {
              studentMap.set(student.studentId, {
                studentId: student.studentId,
                studentName: student.studentName || 'Inconnu',
                gender: student.gender,
                notes: {},
              });
            }
            studentMap.get(student.studentId)!.notes[key] = {
              score: student.score ?? null,
              isAbsent: student.isAbsent ?? false,
            };
          });
        });
        const arr = Array.from(studentMap.values());
        arr.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
        setRows(arr);
      } finally {
        if (!cancelled) setSheetLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [typedEvaluations]);

  // ── Calculs par élève : moyennes, rang, appréciation, note coefficient ─────
  const model = useMemo(() => {
    const perStudent = rows.map((row) => {
      const presentValues = (keys: SecondaryNoteKey[]) => keys
        .map((k) => row.notes[k])
        .filter((n) => n && !n.isAbsent && typeof n.score === 'number')
        .map((n) => n!.score as number);
      const interVals = presentValues(['INT1', 'INT2']);
      const dsVals = presentValues(['DS1', 'DS2']);
      const moyInter = interVals.length
        ? interVals.reduce((a, b) => a + b, 0) / interVals.length
        : null;
      // Formule officielle : (Moy_interros + DS1 + DS2) / 3 — chaque partie
      // disponible compte pour 1 (élève absent à une évaluation exclu).
      const parts: number[] = [];
      if (moyInter !== null) parts.push(moyInter);
      dsVals.forEach((v) => parts.push(v));
      const moyenne = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
      return { row, moyInter, moyenne };
    });
    // Rang dense par moyenne obtenue (ex æquo gérés)
    const rankMap = new Map<string, number>();
    perStudent
      .filter((p) => p.moyenne !== null)
      .sort((a, b) => (b.moyenne as number) - (a.moyenne as number))
      .forEach((p, i, arr) => {
        if (i > 0 && p.moyenne === arr[i - 1].moyenne) {
          rankMap.set(p.row.studentId, rankMap.get(arr[i - 1].row.studentId)!);
        } else {
          rankMap.set(p.row.studentId, i + 1);
        }
      });
    return { perStudent, rankMap };
  }, [rows]);

  // ── Coefficient (matière) — affiché pour 4e → Terminale, éditable ─────────
  const [coefficient, setCoefficient] = useState<number>(1);
  const [coefSaving, setCoefSaving] = useState(false);
  useEffect(() => {
    setCoefficient(selectedSubject?.coefficient ?? 1);
  }, [selectedSubject?.id, selectedSubject?.coefficient]);

  const saveCoefficient = async () => {
    if (!selectedSubject) return;
    const value = Math.min(10, Math.max(1, Number(coefficient) || 1));
    setCoefSaving(true);
    try {
      await apiClient.put(`/subjects/${selectedSubject.id}`, { coefficient: value });
      toastSuccess('Coefficient enregistré', {
        description: `${selectedSubject.name} — coefficient ${value}`,
      });
      onRefresh();
    } catch (err: any) {
      toastError("Erreur d'enregistrement du coefficient", {
        description: err?.response?.data?.message || err?.message || 'Erreur inconnue',
      });
    } finally {
      setCoefSaving(false);
    }
  };

  // ── Récapitulatif ───────────────────────────────────────────────────────────
  const composedCount = model.perStudent.filter((p) => p.moyenne !== null).length;
  const reachedCount = model.perStudent.filter((p) => p.moyenne !== null && (p.moyenne as number) >= 10).length;

  return (
    <div className="space-y-4">
      {/* Header + sélecteurs classe & matière */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Registre des notes</h2>
          <Badge variant="outline" className="text-xs">{levelBadge}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClass(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">— Classe —</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={subjects.length === 0}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[180px]"
          >
            <option value="">— Matière —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Onglets trimestre */}
      {periods.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPeriodId(p.id)}
              className={cn(
                'px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
                selectedPeriodId === p.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {p.name}
            </button>
          ))}
          <div className="flex-1" />
          {!isJunior && selectedSubject && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                Coefficient de {selectedSubject.name} :
              </label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={coefficient}
                onChange={(e) => setCoefficient(Number(e.target.value))}
                className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-center"
              />
              <button
                type="button"
                onClick={saveCoefficient}
                disabled={coefSaving || coefficient === (selectedSubject?.coefficient ?? 1)}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {coefSaving ? '…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contenu */}
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
      ) : evaluations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-gray-500">Aucune note validée pour cette classe</p>
          <p className="text-xs mt-1 text-gray-400">
            Les notes apparaîtront ici une fois validées dans l'onglet « Validation ».
          </p>
        </div>
      ) : (
        <>
          {/* Titre du registre (document) */}
          <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
            <h2 className="text-lg font-bold text-slate-900">
              REGISTRE DES NOTES — {selectedSubject?.name || 'Matière'}
            </h2>
            <div className="text-sm text-slate-600 mt-1">
              Classe : <strong>{selectedClassName}</strong> • {selectedPeriod?.name || 'Trimestre'} • {' '}
              {isJunior ? '1er cycle (sans coefficient)' : 'Coefficient appliqué'}
            </div>
          </div>

          {/* Aucune évaluation typée pour cette matière × trimestre */}
          {!hasAnyTypedEvaluation ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                Aucune note validée pour <strong>{selectedSubject?.name}</strong> au{' '}
                <strong>{selectedPeriod?.name}</strong>. Le registre se remplit dès qu'une{' '}
                Interrogation (1 ou 2) ou un Devoir surveillé (1 ou 2) est validé pour cette matière.
              </div>
            </div>
          ) : sheetLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Chargement des notes…</span>
            </div>
          ) : (
            <>
              {/* Tableau du registre */}
              <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Registre des notes validées — lecture seule
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '170px' }}>Nom et prénom</th>
                      <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-blue-50">Interrogation</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-20 bg-blue-50">Moyenne d'interrogation</th>
                      <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-indigo-50">Devoir surveillé</th>
                      {isJunior ? (
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-20 bg-emerald-50">Moyenne obtenue</th>
                      ) : (
                        <>
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-amber-50">Coefficient</th>
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-20 bg-emerald-50">Note coefficient</th>
                        </>
                      )}
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-14 bg-violet-50">Rang</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Appréciation</th>
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-28">Signature du professeur</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px] text-center min-w-[70px]">Interrogation écrite 1</th>
                      <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px] text-center min-w-[70px]">Interrogation écrite 2</th>
                      <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px] text-center min-w-[70px]">Devoir surveillé 1</th>
                      <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px] text-center min-w-[70px]">Devoir surveillé 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.perStudent.map((p, idx) => {
                      const { row, moyInter, moyenne } = p;
                      const rang = model.rankMap.get(row.studentId);
                      const appreciation = computeAppreciationSecondaire(moyenne);
                      const noteCoef = moyenne !== null ? moyenne * coefficient : null;
                      return (
                        <tr key={row.studentId} className={cn('hover:bg-slate-50', idx % 2 === 1 && 'bg-slate-50/50')}>
                          <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                          <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{row.studentName}</td>
                          {/* Notes : INT1, INT2 */}
                          {(['INT1', 'INT2'] as SecondaryNoteKey[]).map((key) => {
                            const n = row.notes[key];
                            return (
                              <td key={key} className={cn(
                                'border border-slate-300 px-2 py-1 text-center font-bold',
                                n && !n.isAbsent && typeof n.score === 'number' && n.score < 10 && 'text-rose-600',
                              )}>
                                {!n ? '—' : n.isAbsent
                                  ? <span className="text-red-500 text-[10px] font-bold">ABS</span>
                                  : fmtNote(n.score)}
                              </td>
                            );
                          })}
                          {/* Moyenne d'interrogation */}
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                            {moyInter !== null ? fmtNote(moyInter) : '—'}
                          </td>
                          {/* Notes : DS1, DS2 */}
                          {(['DS1', 'DS2'] as SecondaryNoteKey[]).map((key) => {
                            const n = row.notes[key];
                            return (
                              <td key={key} className={cn(
                                'border border-slate-300 px-2 py-1 text-center font-bold',
                                n && !n.isAbsent && typeof n.score === 'number' && n.score < 10 && 'text-rose-600',
                              )}>
                                {!n ? '—' : n.isAbsent
                                  ? <span className="text-red-500 text-[10px] font-bold">ABS</span>
                                  : fmtNote(n.score)}
                              </td>
                            );
                          })}
                          {isJunior ? (
                            /* Moyenne obtenue (6e/5e) */
                            <td className={cn(
                              'border border-slate-300 px-2 py-1 text-center font-bold bg-emerald-50',
                              moyenne !== null && moyenne >= 10 ? 'text-emerald-700' : 'text-rose-600',
                            )}>
                              {moyenne !== null ? fmtNote(moyenne) : '—'}
                            </td>
                          ) : (
                            <>
                              {/* Coefficient (4e → Terminale) */}
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-amber-700 bg-amber-50">
                                {coefficient}
                              </td>
                              {/* Note coefficient */}
                              <td className={cn(
                                'border border-slate-300 px-2 py-1 text-center font-bold bg-emerald-50',
                                moyenne !== null && moyenne >= 10 ? 'text-emerald-700' : 'text-rose-600',
                              )}>
                                {noteCoef !== null ? fmtNote(noteCoef) : '—'}
                              </td>
                            </>
                          )}
                          {/* Rang */}
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                            {rang ? formatRang(rang, row.gender) : '—'}
                          </td>
                          {/* Appréciation */}
                          <td className="border border-slate-300 px-2 py-1 text-center font-semibold">
                            <span className={cn('text-xs', appreciationSecondaireClassName(appreciation))}>
                              {appreciation}
                            </span>
                          </td>
                          {/* Signature du professeur (vide — signature manuscrite) */}
                          <td className="border border-slate-300 h-9" />
                        </tr>
                      );
                    })}
                    {model.perStudent.length === 0 && (
                      <tr>
                        <td colSpan={isJunior ? 11 : 12} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">
                          Aucun élève avec des notes pour cette matière.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Récapitulatif */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Effectif inscrit aux notes</p>
                  <p className="text-2xl font-black mt-1 text-slate-800">{model.perStudent.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Ayant composé</p>
                  <p className="text-2xl font-black mt-1 text-blue-700">{composedCount}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Ont atteint le seuil (10/20)</p>
                  <p className="text-2xl font-black mt-1 text-emerald-700">{reachedCount}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">% de réussite</p>
                  <p className="text-2xl font-black mt-1 text-violet-700">
                    {composedCount > 0 ? ((reachedCount / composedCount) * 100).toFixed(1) : '—'}%
                  </p>
                </div>
              </div>

              {/* Légende */}
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                <p className="font-semibold mb-1">Légende — Registre des notes (Secondaire)</p>
                <ul className="space-y-0.5 ml-4">
                  <li><strong>Moyenne d'interrogation</strong> = (Interrogation écrite 1 + Interrogation écrite 2) / 2</li>
                  <li><strong>Moyenne obtenue</strong> = (Moyenne d'interrogation + Devoir surveillé 1 + Devoir surveillé 2) / 3 — les notes ABS sont exclues du calcul.</li>
                  {!isJunior && <li><strong>Note coefficient</strong> = Moyenne obtenue × Coefficient de la matière (modifiable ci-dessus).</li>}
                  <li><strong>Rang</strong> = classement par moyenne obtenue (ex æquo gérés) · <strong>Appréciation</strong> : ≥16 Très Bien · 14-16 Bien · 12-14 Assez Bien · 10-12 Passable · 8-10 Insuffisant · &lt;8 Faible.</li>
                  <li><strong className="text-red-600">ABS</strong> = élève absent à l'évaluation concernée.</li>
                </ul>
              </div>
            </>
          )}
        </>
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
  language,
  scopedSubModules,
  onBack,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  isSecondaire: boolean;
  language: 'FR' | 'EN';
  scopedSubModules: any;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isEN = language === 'EN';
  // ⭐ V10g — Barème de l'évaluation selon le code du type (piste EN) :
  // First CA / Second CA = /20, Examination = /60.
  const evalTypeCode = group.evaluationTypeCode || '';
  const maxScore = isEN ? getMaxScoreForType(evalTypeCode, language) : 20;

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
    let notReachedBoys = 0, notReachedGirls = 0;

    rows.forEach((row) => {
      const isBoy = row.gender === 'M';
      const isGirl = row.gender === 'F';
      if (isBoy) totalBoys++;
      if (isGirl) totalGirls++;

      // ⭐ Composed = au moins une note saisie (pas absent)
      const hasScore = sortedSubjects.some((subj) => {
        const s = row.scores[subj.id];
        if (!s || s.isAbsent) return false;
        return isMaternelle ? !!s.qualitativeCode : (s.cm !== null || s.score !== null);
      });

      if (hasScore) {
        if (isBoy) composedBoys++;
        if (isGirl) composedGirls++;

        // ⭐ Seuil atteint : 10/20 par matière (primaire/secondaire)
        //    ou TS/S (maternelle)
        let didReach = false;
        if (isMaternelle) {
          const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
          didReach = (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant');
        } else {
          const totalGeneral = sortedSubjects.reduce((sum, subj) => {
            const s = row.scores[subj.id];
            return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
          }, 0);
          // ⭐ Seuil = 10/20 par matière → totalGeneral >= 10 * nbMatieres
          didReach = totalGeneral >= (10 * sortedSubjects.length);
        }

        if (didReach) {
          if (isBoy) reachedBoys++;
          if (isGirl) reachedGirls++;
        } else {
          // ⭐ notReached = a composé mais n'a pas atteint le seuil
          if (isBoy) notReachedBoys++;
          if (isGirl) notReachedGirls++;
        }
      }
    });

    const total = totalBoys + totalGirls;
    const composed = composedBoys + composedGirls;
    const reached = reachedBoys + reachedGirls;
    const notReached = notReachedBoys + notReachedGirls;
    const pctReussite = composed > 0 ? (reached / composed) * 100 : 0;

    return {
      totalBoys, totalGirls, total,
      composedBoys, composedGirls, composed,
      reachedBoys, reachedGirls, reached,
      notReachedBoys, notReachedGirls, notReached,
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

  // ═══ V10g — BROADSHEET EN (lecture seule) : mêmes calculs que GradingSheet ═══
  // TOTAL = somme des notes · AVERAGE = moyenne des notes saisies ·
  // POSITION = rang (1st, 2nd, 3rd…) · MARKS OBTAINED = meilleure note de la
  // classe pour la matière · MARKS OBTAINABLE = barème (First/Second CA /20,
  // Examination /60).
  const enTotalOf = useCallback((row: GradeRow): number =>
    sortedSubjects.reduce((sum, subj) => {
      const s = row.scores[subj.id];
      return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
    }, 0), [sortedSubjects]);

  const enAverageOf = useCallback((row: GradeRow): number | null => {
    const scored = sortedSubjects.filter((subj) => {
      const s = row.scores[subj.id];
      return s && typeof s.score === 'number' && !s.isAbsent;
    });
    if (!scored.length) return null;
    return enTotalOf(row) / scored.length;
  }, [sortedSubjects, enTotalOf]);

  const enRankMap = useMemo(() => {
    const totals = rows.map((r) => ({ id: r.studentId, total: enTotalOf(r) }));
    totals.sort((a, b) => b.total - a.total);
    const map: Record<string, number> = {};
    let lastTotal: number | null = null;
    let lastRank = 0;
    totals.forEach((t, i) => {
      const rank = lastTotal !== null && t.total === lastTotal ? lastRank : i + 1;
      map[t.id] = rank;
      lastTotal = t.total;
      lastRank = rank;
    });
    return map;
  }, [rows, enTotalOf]);

  const enSubjectMaxOf = useCallback((subjectId: string): number | null => {
    let max: number | null = null;
    rows.forEach((r) => {
      const s = r.scores[subjectId];
      if (s && typeof s.score === 'number' && !s.isAbsent && (max === null || s.score > max)) {
        max = s.score;
      }
    });
    return max;
  }, [rows]);

  // Suffixe ordinal anglais : 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st…
  const formatOrdinalEn = (n: number): string => {
    if (n <= 0) return '—';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  return (
    <div className="space-y-4">
            {/* Titre */}
            <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
              <h2 className="text-lg font-bold text-slate-900">
                {isEN ? 'GRADES REGISTER' : 'REGISTRE DES NOTES'} — {isEN ? group.evaluationTypeName : group.evaluationTypeName}
              </h2>
              <div className="text-sm text-slate-600 mt-1">
                {isEN ? 'Class' : 'Classe'} : <strong>{group.className}</strong> • {isEN ? translatePeriodName(group.periodName, language) : group.periodName} • {isEN ? dateRange.replace(/^Le\s/, '').replace(/^Du\s/, 'From ').replace(/\sau\s/, ' to ') : dateRange}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
              <Button variant="ghost" onClick={onBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {isEN ? 'Back to list' : 'Retour à la liste'}
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {rows.length} {isEN ? 'pupils' : 'élèves'}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <BookOpen className="w-3 h-3" />
                  {group.subjects.length} {isEN ? 'subjects' : 'matières'}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isEN ? 'Validated' : 'Validé'}
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
                  {isEN ? 'Validated marks register — read only' : 'Registre des notes validées — lecture seule'}
                </div>
                {isEN ? (
                  /* ══════════════════════════════════════════════════════════════
                   * ⭐ V10g — Piste EN : le Grade Register affiche le broadsheet
                   * « Examination Results » en lecture seule — EXACTEMENT la
                   * même table que la saisie (page 1) et que le récapitulatif
                   * trimestriel : No | NAMES OF SCHOLARS | matières (/barème) |
                   * AVERAGE | POSITION | TOTAL, avec les lignes MARKS
                   * OBTAINABLE / MARKS OBTAINED AVANT les élèves.
                   * Barème : First/Second CA /20 · Examination /60.
                   * ═══════════════════════════════════════════════════════════ */
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th
                          colSpan={2 + sortedSubjects.length + 3}
                          className="border border-slate-700 px-3 py-2 text-center font-black uppercase tracking-wider text-sm"
                        >
                          {'Grades Register — ' + (translatePeriodName(group.periodName, language) || group.periodName)
                            + (group.evaluationTypeName ? ' — ' + group.evaluationTypeName : '')}
                        </th>
                      </tr>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">No</th>
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase min-w-[180px]">Names of Scholars</th>
                        {sortedSubjects.map((subject) => (
                          <th key={subject.id} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                            {subject.name}
                            <div className="text-[9px] text-slate-400 font-normal">/{maxScore}</div>
                          </th>
                        ))}
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-blue-50">Average</th>
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-violet-50">Position</th>
                        <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-emerald-50">Total</th>
                      </tr>
                      {/* ⭐ MARKS OBTAINABLE — barème par matière — AVANT la liste des élèves (modèle PDF) */}
                      <tr className="bg-slate-100 font-bold">
                        <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtainable</th>
                        {sortedSubjects.map((s) => (
                          <th key={`ob-${s.id}`} className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{maxScore}</th>
                        ))}
                        <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-blue-50">{maxScore}</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-emerald-50">{maxScore * sortedSubjects.length}</th>
                      </tr>
                      {/* ⭐ MARKS OBTAINED — meilleure note de la classe par matière — AVANT la liste des élèves (modèle PDF) */}
                      <tr className="bg-slate-50 font-bold">
                        <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtained</th>
                        {sortedSubjects.map((s) => {
                          const max = enSubjectMaxOf(s.id);
                          return (
                            <th key={`mo-${s.id}`} className="border border-slate-300 px-2 py-1.5 text-center text-slate-700">
                              {max !== null ? Number(max).toFixed(2).replace(/\.00$/, '') : '—'}
                            </th>
                          );
                        })}
                        {(() => {
                          const maxes = sortedSubjects.map((s) => enSubjectMaxOf(s.id)).filter((m): m is number => m !== null);
                          const sum = maxes.reduce((a, b) => a + b, 0);
                          const avg = maxes.length ? sum / maxes.length : null;
                          return (
                            <>
                              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-blue-50">{avg !== null ? avg.toFixed(2) : '—'}</th>
                              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
                              <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-emerald-50">{maxes.length ? Number(sum).toFixed(2).replace(/\.00$/, '') : '—'}</th>
                            </>
                          );
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const total = enTotalOf(row);
                        const average = enAverageOf(row);
                        const position = enRankMap[row.studentId] || 0;
                        const hasAnyScore = sortedSubjects.some((subj) => {
                          const s = row.scores[subj.id];
                          return s && typeof s.score === 'number';
                        });
                        return (
                          <tr
                            key={row.studentId}
                            className={cn(
                              'hover:bg-slate-50 transition-colors',
                              idx % 2 === 1 && 'bg-slate-50/50',
                              !hasAnyScore && 'bg-amber-50/30',
                            )}
                          >
                            <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                            <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{row.studentName}</td>
                            {sortedSubjects.map((subject) => {
                              const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                              const t = typeof score.score === 'number' && !score.isAbsent ? score.score : null;
                              return (
                                <td key={subject.id} className={cn(
                                  'border border-slate-300 px-2 py-1 text-center font-bold',
                                  t === null && 'text-slate-300 font-normal',
                                  t !== null && t < maxScore * 0.5 ? 'text-rose-600' : t !== null && t >= maxScore * 0.7 ? 'text-emerald-600' : 'text-slate-900',
                                )}>
                                  {score.isAbsent ? <span className="text-red-500 text-[10px] font-bold">ABS</span>
                                    : t !== null ? t.toFixed(2).replace(/\.00$/, '') : '—'}
                                </td>
                              );
                            })}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                              {average !== null ? average.toFixed(2) : '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-violet-700 bg-violet-50">
                              {hasAnyScore ? formatOrdinalEn(position) : '—'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50">
                              {hasAnyScore ? total.toFixed(2).replace(/\.00$/, '') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
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
                      // ⭐ Seuil = 10/20 par matière → totalGeneral >= 10 * nbMatieres
                      // ⭐ Absent students don't show ✗ (they didn't compose)
                      const isAllAbsent = sortedSubjects.every((subj) => row.scores[subj.id]?.isAbsent);
                      const seuilAtteint = isMaternelle ? null : (
                        !isAllAbsent && totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length)
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
                )}
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
  );
}
