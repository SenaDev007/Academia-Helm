"use client";

/**
 * ============================================================================
 * RÉCEPTION DES ÉPREUVES D'ÉVALUATION — Espace Secrétariat
 * ============================================================================
 *
 * ⭐ Module « Préparation d'examen » (2026-09-21) : le SECRÉTAIRE (ou le
 *    secrétaire-comptable selon le cas) reçoit dans SON espace les blocs
 *    d'épreuves envoyés par les enseignants après validation de la direction.
 *
 * Interface catégorisée : CLASSE → TRIMESTRE → MOIS (hiérarchie exigée).
 *    Le secrétariat peut :
 *      - VISUALISER chaque épreuve (rendu fidèle, matière par matière)
 *      - LANCER L'IMPRESSION des épreuves (PDF professionnel généré par le
 *        backend — une page par matière, format officiel)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, RefreshCw, Printer, FileDown, ChevronRight, ChevronDown,
  NotebookPen, Eye, Inbox, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useModuleContext } from "@/hooks/useModuleContext";

const BLOCK_STATUS: Record<string, { label: string; classes: string }> = {
  SUBMITTED: { label: "En attente de validation direction", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  VALIDATED: { label: "Validé — en attente d'envoi", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  SENT_TO_SECRETARIAT: { label: "Reçu", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}
function formatDateFR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ExamReceptionWorkspace() {
  const { academicYear } = useModuleContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/exam-preparation/secretariat/epreuves?academicYearId=${academicYear.id}`,
        { credentials: "include" },
      );
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [academicYear?.id]);

  useEffect(() => { void load(); }, [load]);

  /**
   * ⭐ IMPRESSION : charge le PDF backend en blob → iframe caché → print().
   *    Repli : ouverture dans un nouvel onglet (visionneuse PDF du navigateur).
   */
  const printBlock = async (blockId: string) => {
    setPrintingId(blockId);
    try {
      const res = await fetch(`/api/exam-preparation/blocks/${blockId}/export-pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("PDF indisponible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const frame = printFrameRef.current;
      if (frame) {
        frame.src = url;
        frame.onload = () => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            window.open(url, "_blank");
          }
        };
      } else {
        window.open(url, "_blank");
      }
    } catch {
      toast.error("Impossible de générer le PDF — ouvrez l'aperçu dans un nouvel onglet");
      window.open(`/api/exam-preparation/blocks/${blockId}/export-pdf`, "_blank");
    } finally {
      setPrintingId(null);
    }
  };

  if (!academicYear?.id || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (selectedBlock) {
    return (
      <ReceptionBlockDetail
        blockId={selectedBlock.id}
        onBack={() => { setSelectedBlock(null); void load(); }}
        onPrint={() => void printBlock(selectedBlock.id)}
        printing={printingId === selectedBlock.id}
      />
    );
  }

  const classes: any[] = data?.classes || [];
  const total = data?.total || 0;
  const received = total;

  return (
    <div className="space-y-4">
      {/* Iframe d'impression (caché) */}
      <iframe ref={printFrameRef} className="hidden" title="impression-epreuves" />

      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Inbox className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Réception des épreuves d&apos;évaluation</h2>
              <p className="text-xs text-slate-500">
                Épreuves transmises par les enseignants après validation de la direction — catégorisées par classe, trimestre et mois
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> {received} bloc(s) reçu(s)
            </span>
            <button onClick={() => void load()} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="Rafraîchir">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Aucune épreuve reçue pour le moment</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Les épreuves d&apos;évaluation envoyées par les enseignants (après validation de la direction)
            apparaîtront ici, classées par classe, trimestre et mois.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <HierarchyTree classes={classes} onOpen={setSelectedBlock} onPrint={printBlock} printingId={printingId} />
        </div>
      )}
    </div>
  );
}

// ─── Arbre Classe → Trimestre → Mois → Blocs ────────────────────────────────

function HierarchyTree({
  classes, onOpen, onPrint, printingId,
}: {
  classes: any[];
  onOpen: (b: any) => void;
  onPrint: (id: string) => void;
  printingId: string | null;
}) {
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [openTri, setOpenTri] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  return (
    <div className="divide-y divide-slate-100">
      {classes.map((c: any) => {
        const classOpen = openClass === c.classId;
        return (
          <div key={c.classId}>
            <button
              onClick={() => { setOpenClass(classOpen ? null : c.classId); setOpenTri(null); setOpenMonth(null); }}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-left"
            >
              {classOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-xs font-bold">{c.className}</span>
              <span className="text-[11px] text-slate-400">{c.trimestres.length} trimestre(s)</span>
            </button>
            {classOpen && (
              <div className="pl-8 pr-4 pb-2">
                {c.trimestres.map((t: any) => {
                  const triKey = `${c.classId}|${t.trimesterLabel}`;
                  const triOpen = openTri === triKey;
                  return (
                    <div key={triKey}>
                      <button
                        onClick={() => { setOpenTri(triOpen ? null : triKey); setOpenMonth(null); }}
                        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg text-left"
                      >
                        {triOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                        <span className="text-xs font-bold text-slate-700">{t.trimesterLabel}</span>
                        <span className="text-[10px] text-slate-400">{t.mois.length} mois</span>
                      </button>
                      {triOpen && (
                        <div className="pl-6">
                          {t.mois.map((m: any) => {
                            const monthKey = `${triKey}|${m.monthLabel}`;
                            const monthOpen = openMonth === monthKey;
                            return (
                              <div key={monthKey}>
                                <button
                                  onClick={() => setOpenMonth(monthOpen ? null : monthKey)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg text-left"
                                >
                                  {monthOpen ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                                  <span className="text-xs font-semibold text-slate-600">{m.monthLabel}</span>
                                  <span className="text-[10px] text-slate-400">{m.blocs.length} évaluation(s)</span>
                                </button>
                                {monthOpen && (
                                  <div className="pl-5 space-y-2 pb-3">
                                    {m.blocs.map((b: any) => {
                                      const st = BLOCK_STATUS[b.status] || BLOCK_STATUS.SENT_TO_SECRETARIAT;
                                      const received = b.status === "SENT_TO_SECRETARIAT";
                                      return (
                                        <div
                                          key={b.id}
                                          className={cn(
                                            "rounded-xl border p-3",
                                            received ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/60",
                                          )}
                                        >
                                          <div className="flex items-start justify-between gap-3 flex-wrap">
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-slate-800">{b.title || "Évaluation"}</p>
                                                <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold", st.classes)}>{st.label}</span>
                                              </div>
                                              <p className="text-[11px] text-slate-500 mt-0.5">
                                                {b.subjectsLabel || `${b.sheetsCount} épreuve(s)`}
                                              </p>
                                              <p className="text-[10px] text-slate-400">
                                                Évaluation du {formatDateFR(b.examDate)}
                                                {b.teacherLastName ? ` • ${b.teacherGender === "F" ? "Mme" : "M."} ${(b.teacherLastName || "").toUpperCase()} ${b.teacherFirstName || ""}` : ""}
                                                {b.sentToSecretariatAt ? ` • Reçu le ${new Date(b.sentToSecretariatAt).toLocaleDateString("fr-FR")}` : ""}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <button
                                                onClick={() => onOpen(b)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                                              >
                                                <Eye className="h-3.5 w-3.5" /> Visualiser
                                              </button>
                                              {received && (
                                                <>
                                                  <button
                                                    onClick={() => onPrint(b.id)}
                                                    disabled={printingId === b.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 shadow-sm disabled:opacity-50"
                                                  >
                                                    {printingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                                    Imprimer
                                                  </button>
                                                  <a
                                                    href={`/api/exam-preparation/blocks/${b.id}/export-pdf`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-white"
                                                    title="Télécharger le PDF"
                                                  >
                                                    <FileDown className="h-3.5 w-3.5" />
                                                  </a>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Détail d'un bloc (visualisation secrétariat, lecture seule) ────────────

function ReceptionBlockDetail({
  blockId, onBack, onPrint, printing,
}: {
  blockId: string; onBack: () => void; onPrint: () => void; printing: boolean;
}) {
  const [block, setBlock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/exam-preparation/blocks/${blockId}`, { credentials: "include" });
        if (res.ok && alive) setBlock(await res.json());
      } catch { /* silent */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [blockId]);

  if (loading || !block) {
    return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const sheets: any[] = block.sheets || [];

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-sky-50 to-white border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={onBack} className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Retour">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 text-xs font-bold">{block.className}</span>
                <span className="text-sm font-bold text-slate-800">{block.title || "Évaluation"}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {block.trimesterLabel} • {block.monthLabel} • Évaluation du {formatDateFR(block.examDate)} • {sheets.length} épreuve(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onPrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 shadow-sm disabled:opacity-50"
            >
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Imprimer les épreuves
            </button>
            <a
              href={`/api/exam-preparation/blocks/${block.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
          </div>
        </div>
        {block.status !== "SENT_TO_SECRETARIAT" && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Ce bloc n&apos;est pas encore arrivé au secrétariat (statut : {BLOCK_STATUS[block.status]?.label || block.status}) —
              impression indicative uniquement.
            </p>
          </div>
        )}
      </div>

      {/* Épreuves (rendu fidèle matière par matière) */}
      <div className="space-y-3">
        {sheets.map((s: any) => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <NotebookPen className="h-4 w-4 text-sky-600 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-800 truncate">
                  {s.epreuveTitle || `Épreuve de ${(s.subjectName || "—").toUpperCase()}`}
                </span>
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
              <ReceptionRichField label="Situation d'évaluation" html={s.situation} />
              <ReceptionRichField label="Tâche" html={s.tache} />
              <ReceptionRichField label="Consigne / Items" html={s.consignes} />
              {(s.maxScoreLabel || s.coefficient) && (
                <p className="text-[11px] text-slate-500 text-right">
                  {s.maxScoreLabel ? `Barème : ${s.maxScoreLabel}` : ""} {s.coefficient ? `• Coefficient : ${s.coefficient}` : ""}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceptionRichField({ label, html }: { label: string; html: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">{label}</div>
      <div className="text-sm text-slate-800 min-h-[36px] p-3 bg-slate-50 rounded-lg border border-slate-200">
        {html && html.replace(/<[^>]*>/g, "").trim() ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="text-slate-300 text-xs italic">Non renseigné</span>
        )}
      </div>
    </div>
  );
}
