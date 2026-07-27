"use client";

/**
 * ============================================================================
 * UNLOCK REQUEST MODAL — Demande de déverrouillage des notes
 * ============================================================================
 *
 * Modal professionnel pour demander à l'administration de déverrouiller
 * une évaluation verrouillée (SUBMITTED ou VALIDATED).
 *
 * Remplace le prompt() générique par un modal élégant avec :
 * - Icône Lock
 * - Champ textarea pour le justificatif (obligatoire)
 * - Compteur de caractères (min 10, max 500)
 * - Boutons Annuler / Envoyer la demande
 * - Loading state pendant l'envoi
 *
 * Usage :
 *   <UnlockRequestModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     evaluationIds={group.evaluationIds}
 *     className={group.className}
 *     evaluationTypeName={group.evaluationTypeName}
 *   />
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
import { Lock, AlertTriangle, Loader2, Send } from "lucide-react";
import apiClient from "@/lib/api/client";
import { toastSuccess, toastError } from "@/lib/toast/toast-helpers";

interface UnlockRequestModalProps {
  open: boolean;
  onClose: () => void;
  evaluationIds: string[];
  className: string;
  evaluationTypeName: string;
}

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

export function UnlockRequestModal({
  open,
  onClose,
  evaluationIds,
  className,
  evaluationTypeName,
}: UnlockRequestModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ⭐ Reset le champ quand le modal se ferme
  useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const isValid = reason.trim().length >= MIN_REASON_LENGTH;
  const remainingChars = MAX_REASON_LENGTH - reason.length;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      // ⭐ Envoyer la demande de déverrouillage pour chaque évaluation
      const errors: string[] = [];
      await Promise.all(
        evaluationIds.map(async (evId) => {
          try {
            await apiClient.post(`/institutional-exams/evaluations/${evId}/unlock-request`, {
              reason: reason.trim(),
            });
          } catch (err: any) {
            console.error(`Failed to send unlock request for evaluation ${evId}:`, err.response?.data || err.message);
            errors.push(evId);
          }
        })
      );

      if (errors.length > 0) {
        throw new Error(`Échec pour ${errors.length} évaluation(s).`);
      }

      toastSuccess("Demande de déverrouillage envoyée", {
        description: "L'administration examinera votre demande et vous notifiera de la décision.",
      });
      onClose();
    } catch (err: any) {
      toastError("Erreur lors de l'envoi de la demande", {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={!submitting}
        className="sm:max-w-[520px] p-0 overflow-hidden rounded-2xl ring-1 ring-slate-200/60 shadow-xl"
      >
        {/* ─── Header ─── */}
        <div className="px-7 pt-7 pb-5 text-slate-900">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl ring-1 bg-amber-50 ring-amber-100">
              <Lock className="w-7 h-7 text-amber-600" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                Demande de déverrouillage
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-slate-700 leading-relaxed">
                Les notes de cette évaluation sont actuellement verrouillées.
                Pour les modifier, vous devez demander un déverrouillage à l'administration.
              </DialogDescription>
              {/* ⭐ Infos contexte */}
              <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3.5 py-2.5 border border-slate-200/70 space-y-0.5">
                <div><span className="font-semibold">Classe :</span> {className}</div>
                <div><span className="font-semibold">Évaluation :</span> {evaluationTypeName}</div>
                <div><span className="font-semibold">Nb évaluations :</span> {evaluationIds.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Champ justificatif ─── */}
        <div className="px-7 pb-3">
          <label htmlFor="unlock-reason" className="block text-sm font-bold text-slate-700 mb-1.5">
            Justificatif de la demande <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Expliquez pourquoi vous avez besoin de modifier ces notes (erreur de saisie, omission, etc.).
            Le justificatif doit contenir au moins {MIN_REASON_LENGTH} caractères.
          </p>
          <textarea
            id="unlock-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
            disabled={submitting}
            placeholder="Ex: Erreur de saisie sur la note de mathématiques de l'élève X. J'ai saisi 14 au lieu de 16..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              {reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {MIN_REASON_LENGTH - reason.trim().length} caractère(s) restant(s)
                </span>
              )}
              {isValid && (
                <span className="text-xs text-emerald-600">
                  ✓ Justificatif valide
                </span>
              )}
            </div>
            <span className={`text-xs ${remainingChars < 50 ? 'text-amber-600' : 'text-slate-400'}`}>
              {remainingChars} restants
            </span>
          </div>
        </div>

        {/* ⭐ Avertissement */}
        <div className="px-7 pb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              L'administration recevra une notification avec votre justificatif.
              Elle décidera d'accepter ou de refuser votre demande.
              En cas d'acceptation, vous serez notifié et pourrez modifier les notes.
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-end gap-3 px-7 py-5 bg-slate-50/80 border-t border-slate-200/60">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="min-w-[110px] h-10 font-medium rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="min-w-[160px] h-10 font-semibold rounded-lg gap-2 transition-all bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-200"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Envoyer la demande
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
