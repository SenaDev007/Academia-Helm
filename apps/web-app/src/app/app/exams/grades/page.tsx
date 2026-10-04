/**
 * ============================================================================
 * MODULE EXAMENS — SAISIE DES NOTES (Navigation par étapes)
 * ============================================================================
 *
 * ⭐ FIX 2026-09-12 — Deux problèmes remontés par l'utilisateur :
 *   1. « Retour à la liste » sautait la page intermédiaire (le trimestre
 *      déplié) et revenait directement à la première page → l'état de
 *      dépliage des accordéons était perdu au retour de la fiche de saisie.
 *      → Remplacé par une vraie navigation PAR ÉTAPE :
 *        Étape 1 : Trimestres → Étape 2 : Classes du trimestre → Étape 3 : Fiche.
 *        « Retour à la liste » (fiche) revient à l'étape 2 (classes du MÊME
 *        trimestre) ; « Retour aux trimestres » (étape 2) revient à l'étape 1.
 *   2. « Les classes ne s'affichent pas » : seules les classes avec des
 *      évaluations programmées apparaissaient. → L'étape 2 affiche
 *      MAINTENANT TOUTES les classes du niveau (avec leur effectif) ;
 *      celles sans évaluation sont grisées avec un renvoi vers l'onglet
 *      Évaluations.
 *
 * Sources de données :
 *   - GET /api/institutional-exams/evaluations — liste filtrée par niveau + langue
 *   - GET /api/all-classes — toutes les classes du niveau (isolation linguistique)
 *   - GET /api/students/enrollments — effectifs par classe
 *   - GET /institutional-exams/grades/evaluation/:id — élèves + notes (GradingSheet)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Users, Loader2,
  RefreshCw, Search, School, Settings, CalendarDays, Plus,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { getAcademicYearPeriods } from '@/services/settings.service';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { filterClassesForLevel } from '../level-isolation';
import { translatePeriodName, getLabels } from '@/lib/exam-anglophone-config';
import { translateClassName } from '@/lib/pedagogy/class-name-en';
import { cn } from '@/lib/utils';
import { GradingSheet, type GroupedEvaluation } from '@/components/exams/GradingSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string };
  subject?: { id: string; name: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

interface PeriodItem {
  id: string;
  name: string;
  type: string;
  isClosed: boolean;
  isActive?: boolean;
}

interface ClassItem {
  id: string;
  name: string;
  code?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_ORDER = [
  'MATERNELLE 1', 'MATERNELLE 2', 'MATERNELLE 3',
  'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
  'PS', 'MS', 'GS',
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6E', '6ÈME', '5E', '5ÈME', '4E', '4ÈME', '3E', '3ÈME',
  'SECONDE', 'PREMIERE', 'PREMIÈRE', 'TERMINALE',
];

function getClassOrderIndex(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  const exact = CLASS_ORDER.indexOf(upper);
  if (exact >= 0) return exact;
  for (let i = 0; i < CLASS_ORDER.length; i++) {
    if (upper.startsWith(CLASS_ORDER[i])) return i;
  }
  return CLASS_ORDER.length;
}

/** Trie les trimestres par ordre naturel (Trimestre 1, 2, 3 / Term 1, 2, 3). */
function periodSortIndex(name: string): number {
  const m = (name || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 99;
}

/** Badge de statut d'une session (même logique que l'ancien renderStatusBadge). */
function SessionStatusBadge({ statuses }: { statuses: string[] }) {
  const isPlanned = statuses.every((s) => s === 'PLANNED' || s === 'DRAFT');
  const isValidatedByTeacher = statuses.some((s) => s === 'OPEN_FOR_GRADING') && !isPlanned;
  const isSubmitted = statuses.some((s) => s === 'SUBMITTED');
  const isValidated = statuses.every((s) => s === 'VALIDATED' || s === 'LOCKED');
  const status = isValidated ? 'Validée'
    : isSubmitted ? 'Soumise au directeur'
    : isValidatedByTeacher ? 'Validée par enseignant'
    : 'Planifiée';
  const color = isValidated ? 'bg-emerald-100 text-emerald-700'
    : isSubmitted ? 'bg-purple-100 text-purple-700'
    : isValidatedByTeacher ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap', color)}>
      {status}
    </span>
  );
}

// ─── Page Principale ──────────────────────────────────────────────────────────

export default function GradesPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isEN = scopeLang === 'EN';
  // ⭐ 2026-10-01 — Labels bilingues pour la piste anglophone (Nursery + Primary)
  const labels = getLabels(scopeLang);

  // Résolution du niveau scolaire (comme evaluations/page.tsx)
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

  // ── Navigation par étapes ─────────────────────────────────────────────────
  //   Étape 1 « trimesters » : liste des trimestres
  //   Étape 2 « classes »     : classes du trimestre sélectionné
  //   Étape 3 « sheet »       : fiche de saisie (selectedGroup)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodItem | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvaluation | null>(null);

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Chargement des évaluations ────────────────────────────────────────────
  const loadEvaluations = useCallback(async () => {
    if (!schoolLevelUuid || !academicYear?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        schoolLevelId: schoolLevelUuid,
        academicYearId: academicYear.id,
      };
      if (scopeLang) params.language = scopeLang;
      const res = await institutionalExamsService.getEvaluations(params);
      setEvaluations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading evaluations', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [schoolLevelUuid, academicYear?.id, scopeLang]);

  // ── Chargement des périodes + classes + effectifs ─────────────────────────
  //    ⭐ 2026-10-01 — OPTIMISATION : on lance les 4 fetchs en parallèle (periods,
  //    classes, enrollments + evaluations) via Promise.all au lieu d'avoir 2
  //    useEffect séparés qui se bloquent mutuellement. Avant : 30s+ pour
  //    afficher les trimestres car loadReferenceData attendait la fin de
  //    loadEvaluations (qui était séquentielle) avant de démarrer.
  const loadReferenceData = useCallback(async () => {
    if (!schoolLevelUuid || !academicYear?.id) return;
    try {
      const [periodsData, allClassesData, enrollmentsData] = await Promise.all([
        getAcademicYearPeriods(academicYear.id).catch(() => []),
        // ⭐ FIX PERF (2026-09-21) : academicYearId transmis → la route BFF
        //    saute la résolution d'année (un aller-retour serveur de moins).
        fetch(`/api/all-classes?academicYearId=${encodeURIComponent(academicYear.id)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/students/enrollments?academicYearId=${encodeURIComponent(academicYear.id)}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);

      // Trimestres triés (Trimestre 1 → 2 → 3)
      const periodList: PeriodItem[] = (Array.isArray(periodsData) ? periodsData : [])
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'Sans période',
          type: p.type || 'TRIMESTER',
          isClosed: !!p.isClosed,
          isActive: !!p.isActive,
        }))
        .sort((a: PeriodItem, b: PeriodItem) =>
          periodSortIndex(a.name) - periodSortIndex(b.name) || a.name.localeCompare(b.name, 'fr')
        );
      setPeriods(periodList);

      // ⭐ TOUTES les classes du niveau + de la piste linguistique (isolation stricte)
      const allClasses = Array.isArray(allClassesData) ? allClassesData : [];
      const levelClasses = filterClassesForLevel(allClasses, schoolLevelUuid, scopeLang);
      // ⭐ 2026-10-01 — Traduire le nom de la classe pour la piste EN (Nursery/Primary mirror)
      const sortedClasses = [...levelClasses]
        .map((c: any) => ({
          id: c.id,
          // ⭐ Pour la piste EN, on traduit (Maternelle 1 → Nursery 1) ; pour la piste FR, on garde le nom original
          name: isEN ? translateClassName(c.name || c.code || '—') : (c.name || c.code || '—'),
          code: c.code,
        }))
        .sort((a, b) => {
          const idxA = getClassOrderIndex(a.name);
          const idxB = getClassOrderIndex(b.name);
          if (idxA !== idxB) return idxA - idxB;
          return a.name.localeCompare(b.name, 'fr');
        });
      setClasses(sortedClasses);

      // ⭐ Effectifs par classe (inscriptions non sorties + élèves actifs)
      const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];
      const counts: Record<string, number> = {};
      const seen = new Map<string, Set<string>>();
      for (const se of enrollments as any[]) {
        if (!se?.classId) continue;
        if (se.status === 'WITHDRAWN' || se.status === 'TRANSFERRED') continue;
        if (se.student?.isActive === false) continue;
        if (!seen.has(se.classId)) seen.set(se.classId, new Set());
        seen.get(se.classId)!.add(se.studentId);
      }
      seen.forEach((students, classId) => { counts[classId] = students.size; });
      setStudentCounts(counts);
    } catch (err) {
      console.error('Error loading reference data', err);
    }
  }, [schoolLevelUuid, academicYear?.id, scopeLang, isEN]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);
  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  // Réinitialiser la navigation si le scope change
  useEffect(() => {
    setSelectedPeriod(null);
    setSelectedGroup(null);
  }, [schoolLevelUuid, scopeLang, academicYear?.id]);

  // ── Grouper les évaluations (comme evaluations/page.tsx) ────────────────────
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
          key,
          classId,
          // ⭐ 2026-10-01 — Traduire le nom de la classe pour la piste EN (Nursery/Primary mirror)
          className: isEN ? translateClassName(ev.class?.name || 'Sans classe') : (ev.class?.name || 'Sans classe'),
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
          firstEvaluation: ev,
          subjectByEvalId: {},
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      if (ev.subject) g.subjectByEvalId![ev.id] = ev.subject.id;
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values()).sort((a, b) => {
      const classCmp = getClassOrderIndex(a.className) - getClassOrderIndex(b.className);
      if (classCmp !== 0) return classCmp;
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
  }, [evaluations, isEN]);

  // Sessions par période (pour les compteurs de l'étape 1)
  const groupsByPeriod = useMemo(() => {
    const map = new Map<string, GroupedEvaluation[]>();
    for (const g of grouped) {
      const pid = g.periodId || '_no_period';
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(g);
    }
    return map;
  }, [grouped]);

  // ⭐ Liste complète des trimestres affichés (étape 1) : les périodes
  // officielles de l'année + les périodes référencées par des évaluations
  // existantes (ex: période supprimée depuis — les notes restent accessibles).
  const displayPeriods = useMemo<PeriodItem[]>(() => {
    const seen = new Set(periods.map((p) => p.id));
    const extras: PeriodItem[] = [];
    groupsByPeriod.forEach((sessions, pid) => {
      if (seen.has(pid)) return;
      seen.add(pid);
      extras.push({
        id: pid,
        name: pid === '_no_period' ? 'Sans période' : (sessions[0]?.periodName || 'Période'),
        type: 'TRIMESTER',
        isClosed: false,
        isActive: false,
      });
    });
    const all = [...periods, ...extras];
    return all
      .filter((p) => p.id !== '_no_period' || groupsByPeriod.has('_no_period'))
      .sort((a, b) =>
        periodSortIndex(a.name) - periodSortIndex(b.name) || a.name.localeCompare(b.name, 'fr')
      );
  }, [periods, groupsByPeriod]);

  // Sessions par classe pour le trimestre sélectionné (étape 2)
  const groupsByClass = useMemo(() => {
    if (!selectedPeriod) return new Map<string, GroupedEvaluation[]>();
    const map = new Map<string, GroupedEvaluation[]>();
    for (const g of grouped) {
      if ((g.periodId || '_no_period') !== selectedPeriod.id) continue;
      if (!map.has(g.classId)) map.set(g.classId, []);
      map.get(g.classId)!.push(g);
    }
    return map;
  }, [grouped, selectedPeriod]);

  // Filtrer les classes par recherche
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const q = searchQuery.toLowerCase().trim();
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, searchQuery]);

  // ── Ouvrir la fiche de saisie pour un groupe ──────────────────────────────
  // ⭐ L'admin peut ouvrir la fiche pour VISUALISATION même si l'évaluation a
  //    déjà été validée par l'enseignant (OPEN_FOR_GRADING), soumise (SUBMITTED)
  //    ou validée (VALIDATED). La fiche GradingSheet passera en mode lecture
  //    seule automatiquement selon le statut.
  const handleOpenGroup = (group: GroupedEvaluation) => {
    setSelectedGroup(group);
  };

  // ── ÉTAPE 3 : Fiche de saisie ─────────────────────────────────────────────
  // ⭐ « Retour à la liste » revient à l'étape 2 (classes du MÊME trimestre) —
  //    le trimestre sélectionné est conservé, plus de saut direct à la 1ère page.
  if (selectedGroup) {
    return (
      <GradingSheet
        group={selectedGroup}
        isMaternelle={isMaternelle}
        isPrimaire={isPrimaire}
        isSecondaire={isSecondaire}
        scopedSubModules={scopedSubModules}
        onBack={() => setSelectedGroup(null)}
        language={scopeLang as 'FR' | 'EN' | undefined}
      />
    );
  }

  const evaluationsLink = `/app/exams/evaluations${scopeLevel ? `?level=${scopeLevel}` : ''}${scopeLang ? `&lang=${scopeLang}` : ''}`;

  // ── ÉTAPE 2 : Classes du trimestre sélectionné ───────────────────────────
  if (selectedPeriod) {
    const periodLabel = isEN
      ? translatePeriodName(selectedPeriod.name, 'EN')
      : selectedPeriod.name;
    return (
      <ModuleContainer
        header={{
          title: isEN ? 'Grading' : 'Saisie des Notes',
          description: isEN
            ? `Step 2 — Select a class in ${periodLabel}.`
            : `Étape 2 — Sélectionnez une classe dans le ${periodLabel}.`,
          icon: 'clipboardList',
        }}
        subModules={{ modules: scopedSubModules, activeModuleId: 'grades' }}
        content={{
          layout: 'full',
          children: (
            <div className="space-y-4">
              {/* Fil d'Ariane : Retour aux trimestres */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPeriod(null)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {isEN ? 'Back to terms' : 'Retour aux trimestres'}
                  </Button>
                  <span className="text-gray-300">/</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {selectedPeriod.name.match(/(\d)/)?.[1] || '?'}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-navy-900 truncate">{periodLabel}</h2>
                      <p className="text-xs text-gray-500">
                        {isEN ? 'Step 2 of 2 — select a class' : 'Étape 2 sur 2 — sélectionnez une classe'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[200px]">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isEN ? 'Search a class…' : 'Rechercher une classe…'}
                      className="bg-transparent border-none focus:outline-none text-sm w-full"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadEvaluations} disabled={loading}>
                    <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                    {isEN ? 'Refresh' : 'Actualiser'}
                  </Button>
                </div>
              </div>

              {/* Grille des classes du niveau */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-3 text-sm text-gray-500">
                    {isEN ? 'Loading classes…' : 'Chargement des classes…'}
                  </span>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <School className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">
                    {isEN ? 'No class found for this level' : 'Aucune classe trouvée pour ce niveau'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {isEN
                      ? 'Create classes in the school structure first.'
                      : 'Créez d\'abord des classes dans la structure de l\'établissement.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredClasses.map((cls) => {
                    const sessions = groupsByClass.get(cls.id) || [];
                    const studentCount = studentCounts[cls.id] || 0;
                    const hasSessions = sessions.length > 0;
                    return (
                      <div
                        key={cls.id}
                        className={cn(
                          'bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-visible',
                          hasSessions ? 'border-gray-200' : 'border-gray-100 opacity-70',
                        )}
                      >
                        {/* En-tête : classe + effectif */}
                        <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                {(cls.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-bold text-navy-900 truncate">{cls.name}</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {studentCount} {isEN ? (studentCount > 1 ? 'pupils' : 'pupil') : (studentCount > 1 ? 'élèves' : 'élève')}
                                  {hasSessions && (
                                    <>
                                      {' · '}
                                      {sessions.length} session{sessions.length > 1 ? 's' : ''}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Corps : sessions d'évaluation du trimestre OU état vide */}
                        <div className="p-5 flex-1 space-y-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {isEN ? 'Assessment sessions' : 'Sessions d\u2019évaluation'}
                          </p>
                          {hasSessions ? (
                            sessions.map((session) => (
                              <button
                                key={session.key}
                                onClick={() => handleOpenGroup(session)}
                                className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left group"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-navy-900 truncate">
                                    {session.evaluationTypeCode ? `[${session.evaluationTypeCode}] ` : ''}
                                    {session.evaluationTypeName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {session.subjects.length} {isEN ? (session.subjects.length > 1 ? 'subjects' : 'subject') : (session.subjects.length > 1 ? 'matières' : 'matière')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <SessionStatusBadge statuses={session.statuses} />
                                  <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {isEN ? 'Enter' : 'Saisir'} <ChevronRight className="w-3 h-3 inline" />
                                  </span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
                              <CalendarDays className="w-8 h-8 text-gray-300 mb-2" />
                              <p className="text-xs text-gray-500 font-medium mb-1">
                                {isEN ? 'No assessment scheduled this term' : 'Aucune évaluation programmée ce trimestre'}
                              </p>
                              <a
                                href={evaluationsLink}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                <Plus className="w-3 h-3" />
                                {isEN ? 'Schedule one in the Assessments tab' : 'Programmer une évaluation (onglet Évaluations)'}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ),
        }}
      />
    );
  }

  // ── ÉTAPE 1 : Liste des trimestres ────────────────────────────────────────
  return (
    <ModuleContainer
      header={{
        title: isEN ? labels.gradingTitle : 'Saisie des Notes',
        description: isEN
          ? 'Step 1 — Select a term, then a class.'
          : 'Étape 1 — Sélectionnez un trimestre, puis une classe.',
        icon: 'clipboardList',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'grades' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Barre de recherche */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={labels.searchPlaceholderGrading}
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={loadEvaluations} disabled={loading}>
                <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                {labels.refresh}
              </Button>
            </div>

            {/* Indicateur de mode (Maternelle qualitative / Primaire quantitative / EN quantitative) */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <Settings className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-bold">{labels.gradingMode}</span>{' '}
                {isMaternelle
                  ? labels.gradingModeMaternelle
                  : scopeLang === 'EN'
                    ? 'Quantitative — First CA (/20), Second CA (/20), Examination (/60) — term total /100 per subject'
                    : isPrimaire
                      ? labels.gradingModePrimaire
                      : labels.gradingModeSecondaire}
              </p>
            </div>

            {/* Cartes des trimestres */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">{labels.loadingEvaluationsGrading}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayPeriods.map((period) => {
                  const periodSessions = groupsByPeriod.get(period.id) || [];
                  const classesWithSessions = new Set(periodSessions.map((g) => g.classId));
                  const totalEvals = periodSessions.reduce((n, g) => n + g.evaluationIds.length, 0);
                  const periodLabel = isEN ? translatePeriodName(period.name, 'EN') : period.name;
                  const matchSearch = !searchQuery.trim()
                    || periodSessions.some((g) =>
                      g.className.toLowerCase().includes(searchQuery.toLowerCase().trim())
                      || g.evaluationTypeName.toLowerCase().includes(searchQuery.toLowerCase().trim()));
                  if (!matchSearch) return null;
                  return (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriod(period)}
                      className={cn(
                        'bg-white rounded-2xl border-2 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col',
                        period.isClosed ? 'border-gray-200 opacity-75' : 'border-gray-200',
                      )}
                    >
                      {/* En-tête trimestre */}
                      <div className="px-5 py-4 bg-gradient-to-br from-indigo-50 to-blue-50 border-b border-blue-100 flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {period.name.match(/(\d)/)?.[1] || '?'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-navy-900 truncate">{periodLabel}</h3>
                            <p className="text-xs text-gray-500">
                              {classesWithSessions.size} {isEN ? (classesWithSessions.size > 1 ? 'classes' : 'class') : (classesWithSessions.size > 1 ? 'classes avec' : 'classe avec')} {isEN ? 'assessments' : 'évaluations'}
                              {totalEvals > 0 && ` · ${totalEvals} ${isEN ? 'sessions' : 'sessions'}`}
                            </p>
                          </div>
                        </div>
                        {period.isActive && !period.isClosed && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                            {isEN ? 'Active' : 'En cours'}
                          </span>
                        )}
                        {period.isClosed && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                            {isEN ? 'Closed' : 'Clôturé'}
                          </span>
                        )}
                      </div>

                      {/* Corps */}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {isEN
                            ? 'Select this term to see all classes of the level and enter grades.'
                            : 'Entrez dans ce trimestre pour voir toutes les classes du niveau et saisir les notes.'}
                        </p>
                        <div className="flex items-center justify-end text-xs font-semibold text-blue-600">
                          {isEN ? 'Open term' : 'Entrer dans le trimestre'} <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    </button>
                  );
                })}

                {periods.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center col-span-full">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-1">{labels.noPeriodsConfigured}</p>
                    <p className="text-sm text-gray-400">
                      {labels.noPeriodsHint}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
