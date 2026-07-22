"use client";

/**
 * ============================================================================
 * PORTAIL ENSEIGNANT — Examens & Notes
 * ============================================================================
 *
 * Vue "Mes évaluations" pour l'enseignant :
 *   - Liste les évaluations assignées à l'enseignant connecté
 *   - Filtrage par piste linguistique (FR / EN) si bilingue activé
 *   - Pour chaque évaluation : saisie des notes de SES élèves
 *
 * L'enseignant ne voit QUE les évaluations qui lui sont assignées
 * (teacherId === user.id). Le backend doit imposer ce check côté serveur.
 *
 * Le système d'annotation s'adapte au niveau scolaire :
 *   - MATERNELLE → qualitatif (TS / S / PS)
 *   - PRIMAIRE → quantitatif /20, coef 1 partout (CM / CP)
 *   - SECONDAIRE → quantitatif /20, coef variable (Devoir / Composition)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, FileEdit, Calendar, BookOpen, Users, Save, Send,
  ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual, BilingualTrackSelector } from '@/contexts/BilingualContext';
import { useAcademicSettings } from '@/hooks/useAcademicSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TeacherEvaluation {
  id: string;
  title: string;
  evaluationDate: string;
  status: string;
  maxScore: number;
  coefficient: number;
  class: { id: string; name: string; schoolLevel?: { code: string; name: string } };
  subject: { id: string; name: string; language?: string };
  evaluationType: { id: string; name: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

interface ScoreEntrySchema {
  columns: Array<{
    key: string;
    label: string;
    type: 'number' | 'text' | 'qualitative';
    max: number;
    required: boolean;
    includedInAverage: boolean;
    visibleOnReportCard: boolean;
    qualitativeOptions?: string[];
    weight?: number;
  }>;
  formula: string;
}

interface StudentGradeRow {
  studentId: string;
  studentName: string;
  matricule: string;
  scores: Record<string, number | string | null>;
  computedAverage: number | null;
  isAbsent: boolean;
  comment: string;
}

export default function TeacherExamsPage() {
  const { user } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack } = useBilingual();

  const [evaluations, setEvaluations] = useState<TeacherEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEval, setSelectedEval] = useState<TeacherEvaluation | null>(null);
  const [schema, setSchema] = useState<ScoreEntrySchema | null>(null);
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [saving, setSaving] = useState(false);

  const teacherId = user?.id || '';

  // === Charger les évaluations de l'enseignant ===
  const loadEvaluations = useCallback(async () => {
    if (!academicYear?.id || !teacherId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        teacherId,
      });
      if (schoolLevel?.id) params.append('schoolLevelId', schoolLevel.id);
      if (isBilingual && currentTrack) params.append('language', currentTrack);

      const res = await fetch(`/api/exams/evaluations?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      setEvaluations(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, teacherId, schoolLevel?.id, isBilingual, currentTrack]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // === Sélectionner une évaluation → charger schéma + élèves ===
  const selectEvaluation = async (eval_: TeacherEvaluation) => {
    setSelectedEval(eval_);
    setSchema(null);
    setStudents([]);

    try {
      // Charger le schéma de saisie (adapte au niveau scolaire)
      const schemaParams = new URLSearchParams({
        schoolYearId: academicYear!.id,
        classId: eval_.class.id,
        subjectId: eval_.subject.id,
      });
      if (schoolLevel?.code) schemaParams.append('levelCode', schoolLevel.code);
      if (eval_.period?.id) schemaParams.append('periodId', eval_.period.id);

      const schemaRes = await fetch(`/api/exams/settings/score-entry-schema?${schemaParams.toString()}`, { credentials: 'include' });
      if (schemaRes.ok) {
        const schemaData = await schemaRes.json();
        setSchema(schemaData);
      }

      // Charger la grading sheet (élèves + notes existantes)
      const sheetRes = await fetch(`/api/exams/evaluations/${eval_.id}/grading-sheet`, { credentials: 'include' });
      if (sheetRes.ok) {
        const sheetData = await sheetRes.json();
        const rows: StudentGradeRow[] = (sheetData?.students || sheetData?.rows || []).map((s: any) => ({
          studentId: s.studentId || s.id,
          studentName: s.studentName || `${s.firstName} ${s.lastName}`,
          matricule: s.matricule || '',
          scores: s.scores || {},
          computedAverage: s.computedAverage ?? null,
          isAbsent: s.isAbsent || false,
          comment: s.comment || '',
        }));
        setStudents(rows);
      }
    } catch (err) {
      toast.error('Erreur lors du chargement de l\'évaluation');
    }
  };

  // === Mettre à jour une note ===
  const updateScore = (studentId: string, columnKey: string, value: number | string | null) => {
    setStudents(prev => prev.map(s =>
      s.studentId === studentId
        ? { ...s, scores: { ...s.scores, [columnKey]: value } }
        : s
    ));
  };

  // === Sauvegarder les notes ===
  const handleSave = async (submit: boolean = false) => {
    if (!selectedEval || !schema) return;
    setSaving(true);
    try {
      const payload = {
        grades: students.map(row => ({
          studentId: row.studentId,
          scores: row.scores,
          computedAverage: row.computedAverage,
          isAbsent: row.isAbsent,
          comment: row.comment,
        })),
        formula: schema.formula,
        submit,
      };
      const res = await fetch(`/api/exams/evaluations/${selectedEval.id}/grading-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erreur');
      toast.success(submit ? 'Notes soumises pour validation' : 'Brouillon enregistré');
      if (submit) {
        setSelectedEval(null);
        loadEvaluations();
      }
    } catch (err) {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // === Render ===
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement de vos évaluations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-blue-600" />
          Mes Évaluations
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Évaluations programmées pour vos classes — {academicYear?.label || 'Année courante'}
          {isBilingual && currentTrack && ` • Piste ${currentTrack === 'FR' ? 'francophone' : 'anglophone'}`}
        </p>
      </div>

      {/* Sélecteur bilingue */}
      <BilingualTrackSelector />

      {/* Liste des évaluations */}
      {!selectedEval ? (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-md flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-500" />
              Évaluations à traiter ({evaluations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evaluations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileEdit className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Aucune évaluation assignée</p>
                <p className="text-xs mt-1">
                  {isBilingual
                    ? `Aucune évaluation sur la piste ${currentTrack === 'FR' ? 'francophone' : 'anglophone'} pour le moment.`
                    : 'Aucune évaluation ne vous est assignée pour le moment.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-black uppercase text-gray-500">Évaluation</TableHead>
                    <TableHead className="text-xs font-black uppercase text-gray-500">Classe</TableHead>
                    <TableHead className="text-xs font-black uppercase text-gray-500">Matière</TableHead>
                    <TableHead className="text-xs font-black uppercase text-gray-500">Date</TableHead>
                    <TableHead className="text-xs font-black uppercase text-gray-500">Statut</TableHead>
                    <TableHead className="text-xs font-black uppercase text-gray-500 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((eval_) => (
                    <TableRow key={eval_.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">
                        {eval_.title || eval_.evaluationType?.name || 'Évaluation'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{eval_.class.name}</div>
                        {eval_.class.schoolLevel && (
                          <div className="text-xs text-gray-500">{eval_.class.schoolLevel.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{eval_.subject.name}</div>
                        {eval_.subject.language && (
                          <Badge variant="outline" className="text-xs mt-0.5">
                            {eval_.subject.language === 'FR' ? 'Français' : 'English'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {eval_.evaluationDate ? format(new Date(eval_.evaluationDate), 'dd MMM yyyy', { locale: fr }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eval_.status === 'VALIDATED' ? 'default' : eval_.status === 'SUBMITTED' ? 'secondary' : 'outline'}>
                          {eval_.status === 'PLANNED' ? 'Planifiée' :
                           eval_.status === 'OPEN_FOR_GRADING' ? 'Ouverte' :
                           eval_.status === 'SUBMITTED' ? 'Soumise' :
                           eval_.status === 'VALIDATED' ? 'Validée' :
                           eval_.status === 'LOCKED' ? 'Verrouillée' :
                           eval_.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectEvaluation(eval_)}
                          disabled={eval_.status === 'VALIDATED' || eval_.status === 'LOCKED'}
                        >
                          Saisir les notes
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        /* === Vue saisie des notes === */
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-md flex items-center">
                  <BookOpen className="w-5 h-5 mr-2 text-blue-500" />
                  {selectedEval.title || selectedEval.evaluationType?.name}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedEval.class.name} • {selectedEval.subject.name} •
                  Barème /{schema?.columns?.[0]?.max || 20}
                  {schema?.columns?.[0]?.type === 'qualitative' && ' (qualitatif TS/S/PS)'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEval(null)}>
                ← Retour
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {schema && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
                <strong>Formule de calcul :</strong> <code>{schema.formula}</code>
                {schema.columns[0]?.type === 'qualitative' && (
                  <span className="block mt-1">⭐ Mode qualitatif maternelle — cochez TS, S ou PS pour chaque domaine.</span>
                )}
              </div>
            )}

            {students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>Aucun élève trouvé dans cette classe.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-black uppercase text-gray-500">Élève</TableHead>
                        {schema?.columns.map((col) => (
                          <TableHead key={col.key} className="text-xs font-black uppercase text-gray-500 text-center">
                            {col.label}
                            {col.weight && col.weight !== 1 && (
                              <span className="block text-[10px] font-normal text-gray-400">coef {col.weight}</span>
                            )}
                          </TableHead>
                        ))}
                        <TableHead className="text-xs font-black uppercase text-gray-500 text-center">Abs.</TableHead>
                        <TableHead className="text-xs font-black uppercase text-gray-500">Appréciation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((row) => (
                        <TableRow key={row.studentId} className={row.isAbsent ? 'bg-amber-50/30' : ''}>
                          <TableCell>
                            <div className="font-medium text-sm">{row.studentName}</div>
                            <div className="text-xs text-gray-500">{row.matricule}</div>
                          </TableCell>
                          {schema?.columns.map((col) => (
                            <TableCell key={col.key} className="text-center">
                              {col.type === 'qualitative' ? (
                                // ⭐ Mode qualitatif maternelle : Select TS/S/PS
                                <div className="flex gap-1 justify-center">
                                  {col.qualitativeOptions?.map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => updateScore(row.studentId, col.key, opt)}
                                      className={`px-2 py-1 rounded text-xs font-bold transition ${
                                        row.scores[col.key] === opt
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                      title={
                                        opt === 'TS' ? 'Très Satisfaisant' :
                                        opt === 'S' ? 'Satisfaisant' :
                                        opt === 'PS' ? 'Peu Satisfaisant' : opt
                                      }
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                // Mode quantitatif : Input number
                                <input
                                  type="number"
                                  min="0"
                                  max={col.max}
                                  step="0.25"
                                  value={row.scores[col.key] ?? ''}
                                  onChange={(e) => updateScore(row.studentId, col.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                                  disabled={row.isAbsent}
                                  className="w-16 px-2 py-1 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={row.isAbsent}
                              onChange={(e) => setStudents(prev => prev.map(s =>
                                s.studentId === row.studentId ? { ...s, isAbsent: e.target.checked } : s
                              ))}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="text"
                              value={row.comment}
                              onChange={(e) => setStudents(prev => prev.map(s =>
                                s.studentId === row.studentId ? { ...s, comment: e.target.value } : s
                              ))}
                              placeholder="—"
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Enregistrer (brouillon)
                  </Button>
                  <Button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Soumettre pour validation
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
