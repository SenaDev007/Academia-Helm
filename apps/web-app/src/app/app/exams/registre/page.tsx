'use client';

/**
 * ============================================================================
 * MODULE EXAMEN — REGISTRE DES NOTES (Récapitulatif)
 * ============================================================================
 *
 * Vue récapitulative de TOUTES les notes d'une classe pour une période donnée.
 * Reproduit le format du registre d'appel/évaluation des PDFs officiels :
 *
 *   - Maternelle : tableau qualitatif (TS/S/PS par domaine × élève)
 *   - Primaire : tableau quantitatif (EM1, EM2, EC par matière × élève + Total)
 *   - Secondaire : tableau quantitatif (INT1, INT2, DS1, DS2 par matière × élève + Moyenne)
 *   - Anglophone : tableau quantitatif (First CA, Second CA, Exam par matière × élève + Total /100)
 *
 * L'enseignant saisit ses notes dans l'onglet "Saisie des notes" (une fiche par
 * évaluation). Cet onglet montre le RÉCAPITULATIF de toutes les notes ensemble.
 *
 * Scope strict : niveau scolaire + piste linguistique depuis l'URL.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2, ClipboardList, Download, AlertCircle, FileText,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { academicSettingsService } from '@/services/academic-settings.service';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';

function RegistreContent() {
  const searchParams = useSearchParams();
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const levelCode = scopeLevel || searchParams.get('level') || '';
  const language = scopeLang || searchParams.get('lang') || 'FR';

  // ✅ FIX: Resolve schoolLevelUuid from URL scope (same pattern as evaluations/grades pages)
  // useModuleContext().schoolLevel.id is education_levels.id, NOT school_levels.id
  // which is what classes.schoolLevelId references
  const activeLevel = useMemo(() =>
    (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === levelCode && l.id !== 'ALL'
    ), [availableLevels, levelCode]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [registreData, setRegistreData] = useState<any[]>([]); // élèves × matières × notes
  const [subjects, setSubjects] = useState<any[]>([]);

  const isMaternelle = levelCode === 'MATERNELLE';
  const isAnglophone = language === 'EN';

  // ── Charger le schéma de saisie (colonnes) ────────────────────────────────
  const loadSchema = useCallback(async () => {
    if (!academicYear?.id || !levelCode) return;
    try {
      const result = await academicSettingsService.getScoreEntrySchema({
        schoolYearId: academicYear.id,
        levelCode,
        language,
      });
      setSchema(result);
    } catch {
      setSchema(null);
    }
  }, [academicYear?.id, levelCode, language]);

  // ── Charger les classes du niveau (pattern identique à evaluations/grades) ──
  const loadClasses = useCallback(async () => {
    if (!schoolLevelUuid) return;
    try {
      // ✅ FIX: use /api/all-classes + client-side filter (same as evaluations page)
      // /api/classes with ?schoolLevelId= fails because of PaginationDto.forbidNonWhitelisted
      const res = await fetch('/api/all-classes', { credentials: 'include' });
      const data = await res.json();
      const allClasses = Array.isArray(data) ? data : (data?.items || []);

      // Filter by school level UUID
      const levelClasses = allClasses.filter((c: any) =>
        c.schoolLevelId === schoolLevelUuid || c.schoolLevel?.id === schoolLevelUuid
      );

      // Optional language filter (FR/EN)
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

      setClasses(langClasses);
    } catch {
      setClasses([]);
    }
  }, [schoolLevelUuid, language]);

  // ── Charger le registre (toutes les notes pour une classe + période) ──────
  const loadRegistre = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    setLoading(true);
    try {
      // Récupérer les matières de la classe (FR only if language filter)
      const subjectsRes = await fetch(
        `/api/pedagogy/subjects?schoolLevelId=${schoolLevelUuid || ''}&academicYearId=${academicYear.id}`,
        { credentials: 'include' }
      );
      const subjectsData = await subjectsRes.json();
      let subjectList = Array.isArray(subjectsData) ? subjectsData : (subjectsData?.items || []);
      // ⭐ Filter subjects by language (FR only if user is on FR track)
      if (language) {
        subjectList = subjectList.filter((s: any) =>
          !s.language || s.language === language || s.language === 'FR'
        );
      }
      setSubjects(subjectList);

      // Récupérer les évaluations de la classe pour cette année
      const gradesRes = await fetch(
        `/api/exams/evaluations?academicYearId=${academicYear.id}&classId=${selectedClassId}${language ? `&language=${language}` : ''}`,
        { credentials: 'include' }
      );
      const evalsData = await gradesRes.json();
      const evaluations = Array.isArray(evalsData) ? evalsData : (evalsData?.items || []);

      // ⭐ Filter evaluations to keep only those for FR subjects (matching subjectList)
      const subjectIds = new Set(subjectList.map((s: any) => s.id));
      const frEvaluations = evaluations.filter((ev: any) => subjectIds.has(ev.subjectId));

      // ⭐ Récupérer les notes pour chaque évaluation via l'API grades
      // (l'endpoint /institutional-exams/grades/evaluation/:id retourne la fiche complète)
      const evalGradesMap = new Map<string, any[]>(); // evaluationId → grades array
      await Promise.all(
        frEvaluations.map(async (ev: any) => {
          try {
            const r = await fetch(`/api/institutional-exams/grades/evaluation/${ev.id}`, { credentials: 'include' });
            if (r.ok) {
              const data = await r.json();
              evalGradesMap.set(ev.id, Array.isArray(data) ? data : []);
            } else {
              evalGradesMap.set(ev.id, []);
            }
          } catch {
            evalGradesMap.set(ev.id, []);
          }
        })
      );

      // ⭐ Récupérer les élèves via la même endpoint (déjà inclus dans les grades)
      // On prend l'union de tous les students apparaissant dans les grades
      const studentMap = new Map<string, any>();
      for (const grades of evalGradesMap.values()) {
        for (const g of grades) {
          if (g.studentId && !studentMap.has(g.studentId)) {
            studentMap.set(g.studentId, {
              id: g.studentId,
              lastName: g.studentName?.split(' ')[0] || '',
              firstName: g.studentName?.split(' ').slice(1).join(' ') || '',
              matricule: g.matricule || '',
              gender: g.gender || '',
            });
          }
        }
      }
      // Fallback: si pas de grades, essayer /api/students
      let students = Array.from(studentMap.values());
      if (students.length === 0) {
        try {
          const studentsRes = await fetch(
            `/api/students?classId=${selectedClassId}&academicYearId=${academicYear.id}`,
            { credentials: 'include' }
          );
          const studentsData = await studentsRes.json();
          students = Array.isArray(studentsData) ? studentsData : (studentsData?.data || []);
        } catch { students = []; }
      }

      // ⭐ Construire le tableau récapitulatif
      // Pour chaque élève, pour chaque matière, récupérer les notes par type d'évaluation
      const registreRows = students.map((student: any) => {
        const row: any = {
          studentId: student.id,
          studentName: `${student.lastName || ''} ${student.firstName || ''}`.trim(),
          matricule: student.matricule || student.studentCode || '',
          subjects: {} as Record<string, any>,
          total: 0,
          average: 0,
        };

        // Pour chaque matière, trouver les évaluations + notes correspondantes
        subjectList.forEach((subject: any) => {
          const subjectNotes: any = { scores: {}, total: 0, average: null };
          // Trouver les évaluations pour cette matière
          const subjectEvals = frEvaluations.filter((ev: any) => ev.subjectId === subject.id);
          if (subjectEvals.length > 0) {
            // Pour chaque évaluation, récupérer le score de cet élève
            subjectEvals.forEach((ev: any) => {
              const evalGrades = evalGradesMap.get(ev.id) || [];
              const studentGrade = evalGrades.find((g: any) => g.studentId === student.id);
              const evalLabel = ev.evaluationType?.code || ev.evaluationType?.name || ev.title || 'Éval';
              if (studentGrade) {
                if (studentGrade.isAbsent) {
                  subjectNotes.scores[evalLabel] = 'ABS';
                } else if (studentGrade.qualitativeCode) {
                  subjectNotes.scores[evalLabel] = studentGrade.qualitativeCode;
                } else if (typeof studentGrade.score === 'number') {
                  subjectNotes.scores[evalLabel] = studentGrade.score;
                  subjectNotes.total += studentGrade.score;
                } else {
                  subjectNotes.scores[evalLabel] = '—';
                }
              } else {
                subjectNotes.scores[evalLabel] = '—';
              }
            });
            // Calculer la moyenne de la matière
            const validScores = Object.values(subjectNotes.scores).filter(
              (v: any) => typeof v === 'number'
            ) as number[];
            if (validScores.length > 0) {
              subjectNotes.average = validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
            }
          }
          row.subjects[subject.id] = subjectNotes;
        });

        // Total et moyenne générale
        const allScores = Object.values(row.subjects).flatMap((s: any) =>
          Object.values(s.scores).filter((v: any) => typeof v === 'number')
        ) as number[];
        row.total = allScores.reduce((sum, s) => sum + s, 0);
        row.average = allScores.length > 0 ? row.total / allScores.length : 0;

        return row;
      });

      setRegistreData(registreRows);
    } catch (err) {
      console.error('Erreur loadRegistre:', err);
      setRegistreData([]);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, academicYear?.id, schoolLevelUuid, language]);

  useEffect(() => { loadSchema(); loadClasses(); }, [loadSchema, loadClasses]);
  useEffect(() => { if (selectedClassId) loadRegistre(); }, [loadRegistre]);

  const columns = schema?.columns || [];
  const scoreMax = isAnglophone ? 100 : 20;

  return (
    <div className="space-y-4">
      {/* En-tête + filtres */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Registre des notes</h2>
          <Badge variant="outline" className="text-xs">
            {levelCode} {language ? `· ${language}` : ''}
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
          <Button variant="outline" size="sm" disabled={!selectedClassId}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Info barème */}
      {schema && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>Barème :</strong> {isMaternelle ? 'Qualitatif (TS/S/PS)' : `Quantitatif /${scoreMax}`}
          {' — '}
          <strong>Formule :</strong> <code>{schema.formula}</code>
        </div>
      )}

      {/* Tableau du registre */}
      {!selectedClassId ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Sélectionnez une classe pour afficher le registre</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Chargement du registre...</span>
        </div>
      ) : registreData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Aucune note saisie pour cette classe</p>
            <p className="text-xs mt-1">Les notes apparaîtront ici une fois saisies dans l'onglet "Saisie des notes".</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-md">
              Registre — {classes.find(c => c.id === selectedClassId)?.name || 'Classe'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-black uppercase text-gray-500 sticky left-0 bg-gray-50 z-10">
                      Élève
                    </TableHead>
                    {/* Colonnes pour chaque type d'évaluation par matière */}
                    {subjects.map(subject => (
                      <TableHead key={subject.id} className="text-center text-xs font-black uppercase text-gray-500">
                        {subject.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-center text-xs font-black uppercase text-gray-500 bg-blue-50">
                      Total /{scoreMax}
                    </TableHead>
                    <TableHead className="text-center text-xs font-black uppercase text-gray-500 bg-blue-50">
                      Moyenne
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registreData.map((row, i) => (
                    <TableRow key={row.studentId} className={i % 2 === 0 ? '' : 'bg-gray-50/30'}>
                      <TableCell className="sticky left-0 bg-white z-10">
                        <div className="font-semibold text-sm text-gray-900">{row.studentName}</div>
                        <div className="text-xs text-gray-400 font-mono">{row.matricule}</div>
                      </TableCell>
                      {subjects.map(subject => {
                        const subjectData = row.subjects[subject.id];
                        if (isMaternelle) {
                          // Maternelle : afficher le code qualitatif majoritaire
                          const codes = Object.values(subjectData?.scores || {});
                          const counts: Record<string, number> = {};
                          codes.forEach((c: any) => { if (c && c !== '—') counts[c] = (counts[c] || 0) + 1; });
                          const majoritaire = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
                          return (
                            <TableCell key={subject.id} className="text-center">
                              {majoritaire ? (
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  majoritaire === 'TS' ? 'bg-emerald-100 text-emerald-700' :
                                  majoritaire === 'S' ? 'bg-blue-100 text-blue-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{majoritaire}</span>
                              ) : '—'}
                            </TableCell>
                          );
                        }
                        // Quantitatif : afficher le total de la matière
                        const total = subjectData?.total || 0;
                        return (
                          <TableCell key={subject.id} className="text-center text-sm font-semibold">
                            {total > 0 ? total.toFixed(2) : '—'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-sm font-bold bg-blue-50/50">
                        {row.total > 0 ? row.total.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm font-bold bg-blue-50/50">
                        {row.average > 0 ? row.average.toFixed(2) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Légende */}
      {isMaternelle && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-bold">Légende :</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">TS = Très Satisfaisant</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">S = Satisfaisant</span>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">PS = Peu Satisfaisant</span>
        </div>
      )}
    </div>
  );
}

export default function RegistrePage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  return (
    <ModuleContainer
      header={{
        title: 'Registre des notes',
        description: 'Récapitulatif de toutes les notes par classe et par période.',
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
