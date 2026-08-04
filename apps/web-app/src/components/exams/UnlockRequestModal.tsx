"use client";

/**
 * ============================================================================
 * UNLOCK REQUEST MODAL — Demande de déverrouillage GRANULAIRE
 * ============================================================================
 *
 * L'enseignant sélectionne :
 *   1. Les élèves concernés (au moins 1)
 *   2. Les matières concernées (au moins 1)
 *   3. Un justificatif (motif de la demande)
 *
 * Seuls les élèves + matières sélectionnés seront déverrouillés.
 * Les autres élèves et matières restent verrouillés.
 * ============================================================================
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Lock, AlertTriangle, Loader2, Send,
  CheckSquare, Square, Users, BookOpen, Search,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { toastSuccess, toastError } from "@/lib/toast/toast-helpers";

interface UnlockRequestModalProps {
  open: boolean;
  onClose: () => void;
  evaluationIds: string[];
  className: string;
  evaluationTypeName: string;
  /** Liste des élèves affichés dans le tableau de notes */
  students?: Array<{ studentId: string; studentName: string; matricule?: string }>;
  /** Liste des matières affichées dans le tableau */
  subjects?: Array<{ id: string; name: string }>;
}

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

export function UnlockRequestModal({
  open,
  onClose,
  evaluationIds,
  className,
  evaluationTypeName,
  students = [],
  subjects = [],
}: UnlockRequestModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
      setSelectedStudentIds(new Set());
      setSelectedSubjectIds(new Set());
      setStudentSearch("");
    }
  }, [open]);

  const isValid = reason.trim().length >= MIN_REASON_LENGTH
    && selectedStudentIds.size > 0
    && selectedSubjectIds.size > 0;
  const remainingChars = MAX_REASON_LENGTH - reason.length;

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(new Set(students.map((s) => s.studentId)));
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(new Set(subjects.map((s) => s.id)));
  };

  const filteredStudents = students.filter((s) =>
    !studentSearch ||
    s.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.matricule || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const studentIdsArr = Array.from(selectedStudentIds);
      const subjectIdsArr = Array.from(selectedSubjectIds);
      const studentNamesStr = students
        .filter((s) => selectedStudentIds.has(s.studentId))
        .map((s) => s.studentName)
        .join(', ');
      const subjectNamesStr = subjects
        .filter((s) => selectedSubjectIds.has(s.id))
        .map((s) => s.name)
        .join(', ');

      const errors: string[] = [];
      await Promise.all(
        evaluationIds.map(async (evId) => {
          try {
            await apiClient.post(`/institutional-exams/evaluations/${evId}/unlock-request`, {
              reason: reason.trim(),
              studentIds: studentIdsArr,
              subjectIds: subjectIdsArr,
              studentNames: studentNamesStr,
              subjectNames: subjectNamesStr,
            });
          } catch (err: any) {
            console.error(`Failed for evaluation ${evId}:`, err.response?.data || err.message);
            errors.push(evId);
          }
        })
      );

      if (errors.length > 0 && errors.length === evaluationIds.length) {
        throw new Error("Échec de l'envoi pour toutes les évaluations.");
      }

      toastSuccess("Demande de déverrouillage envoyée", {
        description: `${studentIdsArr.length} élève(s) · ${subjectIdsArr.length} matière(s) — L'administration examinera votre demande.`,
      });
      onClose();
    } catch (err: any) {
      toastError("Erreur lors de l'envoi", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={!submitting}
        className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-0 overflow-hidden rounded-2xl ring-1 ring-slate-200/60 shadow-xl"
      >
        {/* ─── Header ─── */}
        <div className="px-7 pt-7 pb-4 text-slate-900">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl ring-1 bg-amber-50 ring-amber-100">
              <Lock className="w-6 h-6 text-amber-600" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                Demande de déverrouillage
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-700">
                Sélectionnez les élèves et matières concernés. Seules les notes sélectionnées seront déverrouillées.
              </DialogDescription>
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200/70">
                <span className="font-semibold">Classe :</span> {className} · <span className="font-semibold">Évaluation :</span> {evaluationTypeName}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Sélection des élèves ─── */}
        <div className="px-7 pb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Élèves concernés <span className="text-red-500">*</span>
            </label>
            <button onClick={selectAllStudents} className="text-xs text-blue-600 hover:underline font-medium">
              Tout sélectionner
            </button>
          </div>
          {students.length > 6 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Rechercher un élève..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          )}
          <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Aucun élève</div>
            ) : (
              filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.has(student.studentId);
                return (
                  <button
                    key={student.studentId}
                    onClick={() => toggleStudent(student.studentId)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span className="text-sm text-slate-700 flex-1 truncate">{student.studentName}</span>
                    {student.matricule && (
                      <span className="text-xs text-slate-400">{student.matricule}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {selectedStudentIds.size} élève(s) sélectionné(s)
          </p>
        </div>

        {/* ─── Sélection des matières ─── */}
        <div className="px-7 pb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Matières concernées <span className="text-red-500">*</span>
            </label>
            <button onClick={selectAllSubjects} className="text-xs text-blue-600 hover:underline font-medium">
              Tout sélectionner
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => {
              const isSelected = selectedSubjectIds.has(subject.id);
              return (
                <button
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-300'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  {subject.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {selectedSubjectIds.size} matière(s) sélectionnée(s)
          </p>
        </div>

        {/* ─── Champ justificatif ─── */}
        <div className="px-7 pb-3">
          <label className="block text-sm font-bold text-slate-700 mb-1.5">
            Justificatif <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
            disabled={submitting}
            placeholder="Ex: Erreur de saisie sur la note de mathématiques de l'élève X. J'ai saisi 14 au lieu de 16..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-slate-50"
          />
          <div className="flex items-center justify-between mt-1">
            {reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {MIN_REASON_LENGTH - reason.trim().length} caractère(s) restant(s)
              </span>
            )}
            {reason.trim().length >= MIN_REASON_LENGTH && (
              <span className="text-xs text-emerald-600">✓ Justificatif valide</span>
            )}
            <span className={`text-xs ${remainingChars < 50 ? 'text-amber-600' : 'text-slate-400'}`}>
              {remainingChars} restants
            </span>
          </div>
        </div>

        {/* ─── Avertissement ─── */}
        <div className="px-7 pb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Seules les notes des élèves et matières sélectionnés seront déverrouillées.
              Les autres notes resteront verrouillées.
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-end gap-3 px-7 py-4 bg-slate-50/80 border-t border-slate-200/60">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="min-w-[100px] h-10 font-medium rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="min-w-[160px] h-10 font-semibold rounded-lg gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Envoi...</>
            ) : (
              <><Send className="h-4 w-4" /> Envoyer la demande</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
