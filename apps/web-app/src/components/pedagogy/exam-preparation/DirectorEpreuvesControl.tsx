"use client";

/**
 * ============================================================================
 * ÉPREUVES D'ÉVALUATION — Contrôle Direction (validation des BLOCS)
 * ============================================================================
 *
 * ⭐ Module « Préparation d'examen » (2026-09-21) : le directeur reçoit les
 *    BLOCS d'épreuves soumis par les enseignants (pas chaque épreuve isolée).
 *    Il peut :
 *      - consulter chaque épreuve (matière par matière, rendu fidèle)
 *      - télécharger l'aperçu PDF professionnel
 *      - VALIDER ou REJETER le bloc (motif obligatoire en cas de rejet)
 *      - ajouter une observation direction
 *    Dès la validation, l'enseignant est notifié et peut envoyer le bloc au
 *    secrétariat pour impression.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Clock, FileDown,
  ChevronRight, Printer, Send, AlertTriangle, NotebookPen, Eye,
} from "lucide-react";
import { toast } from "sonner";

const BLOCK_STATUS: Record<string, { label: string; classes: string }> = {
  DRAFT: { label: "Brouillon", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  SUBMITTED: { label: "À valider", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  VALIDATED: { label: "Validé", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejeté", classes: "bg-red-50 text-red-700 border-red-200" },
  SENT_TO_SECRETARIAT: { label: "Au secrétariat", classes: "bg-violet-50 text-violet-700 border-violet-200" },
};

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}
function formatDateFR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function PendingEpreuvesTab({
  tenantId, academicYearId, userId, refreshKey, onRefresh,
}: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"SUBMITTED" | "VALIDATED" | "REJECTED" | "ALL">("SUBMITTED");
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);

  const load = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/exam-preparation/director/pending?academicYearId=${academicYearId}&status=${statusFilter}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setBlocks(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [academicYearId, statusFilter]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (selectedBlock) {
    return (
      <EpreuveBlockDirectorDetail
        blockId={selectedBlock.id}
        userId={userId}
        onBack={() => { setSelectedBlock(null); void load(); onRefresh(); }}
      />
    );
  }

  const FILTERS = [
    { id: "SUBMITTED", label: "À valider" },
    { id: "VALIDATED", label: "Validés" },
    { id: "REJECTED", label: "Rejetés" },
    { id: "ALL", label: "Tous" },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors",
              statusFilter === f.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => void load()} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-14">
          <NotebookPen className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">
            {statusFilter === "SUBMITTED" ? "Aucun bloc d'épreuves en attente de validation" : "Aucun bloc"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Les blocs d&apos;épreuves soumis par les enseignants apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {blocks.map((b: any) => {
            const st = BLOCK_STATUS[b.status] || BLOCK_STATUS.DRAFT;
            const teacherName = b.teacherFirstName || b.teacherLastName
              ? `${b.teacherGender === "F" ? "Mme" : "M."} ${(b.teacherLastName || "").toUpperCase()} ${b.teacherFirstName || ""}`.trim()
              : "—";
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBlock(b)}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">{b.className}</span>
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold", st.classes)}>{st.label}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate mt-1">{b.title || "Évaluation"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {b.monthLabel || "—"} • {b.trimesterLabel || "—"} • {formatDateFR(b.examDate)} • {b.sheetsCount || 0} épreuve(s)
                    </p>
                    <p className="text-[11px] text-slate-400">Enseignant : {teacherName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
                </div>
                {b.rejectionReason && (
                  <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-2 line-clamp-2">
                    Motif : {b.rejectionReason}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Détail d'un bloc : épreuves + validation ───────────────────────────────

function EpreuveBlockDirectorDetail({
  blockId, userId, onBack,
}: {
  blockId: string; userId: string; onBack: () => void;
}) {
  const [block, setBlock] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"VALIDATED" | "REJECTED" | null>(null);
  const [observation, setObservation] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-preparation/blocks/${blockId}`, { credentials: "include" });
      if (res.ok) {
        const b = await res.json();
        setBlock(b);
        setObservation(b.directorObservation || "");
      } else {
        toast.error("Bloc introuvable");
        onBack();
      }
    } catch { toast.error("Erreur réseau"); onBack(); }
    finally { setLoading(false); }
  }, [blockId]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (act: "VALIDATED" | "REJECTED") => {
    if (act === "REJECTED" && !rejectionReason.trim()) {
      toast.error("Un motif de rejet est obligatoire");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-preparation/director/validate/${blockId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: act,
          validatedBy: userId,
          rejectionReason: act === "REJECTED" ? rejectionReason.trim() : undefined,
          directorObservation: observation.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.message || "Action impossible"); return; }
      toast.success(act === "VALIDATED" ? "Bloc d'épreuves validé — l'enseignant a été notifié" : "Bloc rejeté — l'enseignant a été notifié");
      onBack();
    } catch { toast.error("Erreur réseau"); }
    finally { setBusy(false); setAction(null); }
  };

  if (loading || !block) {
    return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const sheets: any[] = block.sheets || [];
  const st = BLOCK_STATUS[block.status] || BLOCK_STATUS.DRAFT;
  const teacherName = block.teacherName || "—";
  const canDecide = block.status === "SUBMITTED";

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Retour">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">{block.className}</span>
                <span className="text-sm font-bold text-slate-800">{block.title || "Évaluation"}</span>
                <span className={cn("px-2 py-0.5 rounded-md border text-[11px] font-bold", st.classes)}>{st.label}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {block.trimesterLabel} • {block.monthLabel} • Évaluation du {formatDateFR(block.examDate)} • {sheets.length} épreuve(s) • Enseignant : {teacherName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/api/exam-preparation/blocks/${block.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5" /> Aperçu PDF
            </a>
          </div>
        </div>

        {canDecide && (
          <div className="px-4 py-3 border-b border-slate-100 space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Observation de la direction (facultative — transmise à l&apos;enseignant)
              </label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={2}
                placeholder="Ex : Épreuve très bien construite ; ajouter le barème de l'item 3…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setAction("REJECTED")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" /> Rejeter le bloc
              </button>
              <button
                onClick={() => setAction("VALIDATED")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> Valider le bloc
              </button>
            </div>
          </div>
        )}
        {block.status === "REJECTED" && block.rejectionReason && (
          <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700"><b>Rejeté :</b> {block.rejectionReason}</p>
          </div>
        )}
        {block.status === "VALIDATED" && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <p className="text-xs text-emerald-700">
              Validé le {block.validatedAt ? new Date(block.validatedAt).toLocaleString("fr-FR") : "—"} — l&apos;enseignant peut l&apos;envoyer au secrétariat.
            </p>
          </div>
        )}
        {block.status === "SENT_TO_SECRETARIAT" && (
          <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
            <Printer className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <p className="text-xs text-violet-700">Envoyé au secrétariat le {block.sentToSecretariatAt ? new Date(block.sentToSecretariatAt).toLocaleString("fr-FR") : "—"}.</p>
          </div>
        )}
      </div>

      {/* Épreuves (rendu fidèle matière par matière) */}
      <div className="space-y-3">
        {sheets.map((s: any) => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <NotebookPen className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-800 truncate">{s.epreuveTitle || `Épreuve de ${(s.subjectName || "—").toUpperCase()}`}</span>
                {s.durationLabel && <span className="text-[11px] text-slate-500">• Durée : {s.durationLabel}</span>}
              </div>
              <a
                href={`/api/exam-preparation/sheets/${s.id}/export-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-500 text-[11px] font-semibold hover:bg-white"
              >
                <FileDown className="h-3 w-3" /> PDF
              </a>
            </div>
            <div className="p-4 space-y-3">
              <DirectorRichField label="Situation d'évaluation" html={s.situation} />
              <DirectorRichField label="Tâche" html={s.tache} />
              <DirectorRichField label="Consigne / Items" html={s.consignes} />
              {s.cleCorrection && <DirectorRichField label="Clé de correction" html={s.cleCorrection} />}
              {s.grilleCorrection && <DirectorRichField label="Grille de correction" html={s.grilleCorrection} />}
              {(s.maxScoreLabel || s.coefficient) && (
                <p className="text-[11px] text-slate-500 text-right">
                  {s.maxScoreLabel ? `Barème : ${s.maxScoreLabel}` : ""} {s.coefficient ? `• Coefficient : ${s.coefficient}` : ""}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modales de décision */}
      {action && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center gap-2 mb-3">
              {action === "VALIDATED" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <h3 className="text-sm font-bold text-slate-800">
                {action === "VALIDATED" ? "Valider ce bloc d'épreuves ?" : "Rejeter ce bloc d'épreuves ?"}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {action === "VALIDATED"
                ? "L'enseignant sera notifié et pourra envoyer les épreuves au secrétariat pour impression."
                : "L'enseignant sera notifié et pourra corriger puis re-soumettre le bloc."}
            </p>
            {action === "REJECTED" && (
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Motif du rejet (obligatoire) — ex : items 2 et 4 hors programme…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-300"
              />
            )}
            {observation.trim() && (
              <p className="text-[11px] text-slate-400 mt-1">
                Observation jointe : « {observation.trim()} »
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAction(null)}
                disabled={busy}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={() => void decide(action)}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold shadow-sm disabled:opacity-50",
                  action === "VALIDATED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700",
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : action === "VALIDATED" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectorRichField({ label, html }: { label: string; html: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">{label}</div>
      <div className="text-sm text-slate-800 min-h-[36px] p-3 bg-slate-50 rounded-lg border border-slate-200">
        {html && html.replace(/<[^>]*>/g, "").trim() ? (
          <div className="epreuve-rich-preview" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="text-slate-300 text-xs italic">Non renseigné</span>
        )}
      </div>
    </div>
  );
}
