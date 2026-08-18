'use client';

/**
 * ============================================================================
 * CORRECTIONS FEEDBACK TAB — Saisie des notes et feedbacks
 * ============================================================================
 *
 * Workflow :
 *   1. L'utilisateur sélectionne une activité (HomeworkEntry) — GET /homeworks
 *   2. On charge les soumissions existantes pour ce devoir —
 *      GET /homeworks/:id/submissions
 *   3. Pour chaque élève sans soumission, l'utilisateur peut saisir une
 *      nouvelle correction (score, maxScore, feedback)
 *   4. PUT/POST /homeworks/:id/submissions (upsert) — body :
 *      { studentId, academicYearId, schoolLevelId, score?, maxScore?,
 *        feedback?, gradedBy, content? }
 *
 * Affichage en deux colonnes :
 *   - Liste des élèves (avec score existant si déjà corrigé)
 *   - Modal/panneau inline pour saisir la correction
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Edit,
} from 'lucide-react';
import {
  apiFetch, formatDateFR,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

interface CorrectionsFeedbackTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}

export function CorrectionsFeedbackTab({
  teacherId,
  academicYearId,
  schoolLevelId,
  classes,
}: CorrectionsFeedbackTabProps) {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [selectedHwId, setSelectedHwId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [modalStudent, setModalStudent] = useState<any | null>(null);

  // === Chargement de la liste des activités (tous types sauf LESSON/RECITATION
  //     qui ont leur propre onglet de suivi)
  const loadHomeworks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
      );
      const list = (Array.isArray(data) ? data : []).filter(
        (hw) => hw.taskType !== 'LESSON' && hw.taskType !== 'RECITATION',
      );
      setHomeworks(list);
      if (list.length > 0) setSelectedHwId(list[0].id);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setHomeworks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId]);

  useEffect(() => {
    loadHomeworks();
  }, [loadHomeworks]);

  // === Charger les élèves + soumissions pour le devoir sélectionné ===
  const loadStudentsAndSubmissions = useCallback(async () => {
    if (!selectedHwId) {
      setStudents([]);
      setSubmissions([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const [studentsData, submissionsData] = await Promise.all([
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks/${selectedHwId}/students`,
        ).catch(() => [] as any[]),
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks/${selectedHwId}/submissions`,
        ).catch(() => [] as any[]),
      ]);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedHwId]);

  useEffect(() => {
    loadStudentsAndSubmissions();
  }, [loadStudentsAndSubmissions]);

  // Map studentId → submission (pour lookup rapide)
  const submissionsByStudent = useMemo(() => {
    const map = new Map<string, any>();
    (submissions || []).forEach((s) => {
      if (s.studentId) map.set(s.studentId, s);
    });
    return map;
  }, [submissions]);

  const selectedHw = homeworks.find((h) => h.id === selectedHwId);

  // === Sauvegarder une correction (upsert) ===
  const handleSave = async (data: {
    studentId: string;
    score: string;
    maxScore: string;
    feedback: string;
  }) => {
    if (!selectedHwId || !academicYearId || !schoolLevelId || !teacherId) {
      toast.error('Contexte manquant.');
      return;
    }
    try {
      await apiFetch(`/api/pedagogy-space/homeworks/${selectedHwId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: data.studentId,
          academicYearId,
          schoolLevelId,
          score: data.score ? parseFloat(data.score) : undefined,
          maxScore: data.maxScore ? parseFloat(data.maxScore) : 20,
          feedback: data.feedback || undefined,
          gradedBy: teacherId,
        }),
      });
      toast.success('Correction enregistrée.');
      setModalStudent(null);
      // Recharger les soumissions
      loadStudentsAndSubmissions();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* === En-tête + filtres === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Corrections & retours
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Saisissez les notes et feedbacks pour chaque élève.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedHwId}
            onChange={(e) => setSelectedHwId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[280px]"
          >
            {homeworks.length === 0 && <option value="">— Aucune activité —</option>}
            {homeworks.map((hw) => (
              <option key={hw.id} value={hw.id}>
                {hw.title} — {hw.class?.name || '—'} ({formatDateFR(hw.dueDate)})
              </option>
            ))}
          </select>
          <button
            onClick={loadStudentsAndSubmissions}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* === Table === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des activités…
        </div>
      ) : homeworks.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <CheckCircle2 className="w-10 h-10 text-slate-200" />
          <p className="text-sm font-semibold text-slate-400">
            Aucune activité à corriger
          </p>
          <p className="text-xs text-slate-300">
            Créez d'abord une activité dans l'onglet Devoirs & Exercices.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Chargement des élèves…
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-2">
              <XCircle className="w-8 h-8 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">
                Aucun élève pour cette activité
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3">Élève</th>
                    <th className="px-4 py-3">Note attribuée</th>
                    <th className="px-4 py-3">Feedback</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const sub = submissionsByStudent.get(s.studentId);
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-900">
                            {s.student?.lastName} {s.student?.firstName}
                          </p>
                          {s.student?.matricule && (
                            <p className="text-xs text-slate-400">
                              Mat: {s.student.matricule}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sub ? (
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-bold',
                                (sub.score ?? 0) < (sub.maxScore ?? 20) / 2
                                  ? 'bg-rose-50 text-rose-700'
                                  : (sub.score ?? 0) < (sub.maxScore ?? 20) * 0.7
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {sub.score} / {sub.maxScore ?? 20}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Non corrigé
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sub?.feedback ? (
                            <p className="text-xs text-slate-700 italic line-clamp-1">
                              « {sub.feedback} »
                            </p>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              setModalStudent({ student: s, submission: sub })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                            {sub ? 'Modifier' : 'Corriger'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === Modal de correction === */}
      {modalStudent && (
        <CorrectionModal
          student={modalStudent.student}
          submission={modalStudent.submission}
          defaultMaxScore={selectedHw?.maxScore || 20}
          onClose={() => setModalStudent(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL — Saisir une correction (score + maxScore + feedback)
// ============================================================================

function CorrectionModal({
  student,
  submission,
  defaultMaxScore,
  onClose,
  onSave,
}: {
  student: any;
  submission: any | null;
  defaultMaxScore: number;
  onClose: () => void;
  onSave: (data: {
    studentId: string;
    score: string;
    maxScore: string;
    feedback: string;
  }) => Promise<void>;
}) {
  const [score, setScore] = useState(
    submission?.score != null ? String(submission.score) : '',
  );
  const [maxScore, setMaxScore] = useState(
    submission?.maxScore != null
      ? String(submission.maxScore)
      : String(defaultMaxScore || 20),
  );
  const [feedback, setFeedback] = useState(submission?.feedback || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        studentId: student.studentId,
        score: score.trim(),
        maxScore: maxScore.trim() || '20',
        feedback: feedback.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Correction — {student.student?.lastName} {student.student?.firstName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {submission ? 'Modifier la note et le feedback' : 'Saisir une nouvelle correction'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            type="button"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {/* Note + Barème */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Note obtenue
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Ex: 15"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Barème
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              />
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Feedback / Appréciation
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Ex: Bon travail, mais revoir les fractions…"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium resize-y"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            type="button"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            type="button"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
