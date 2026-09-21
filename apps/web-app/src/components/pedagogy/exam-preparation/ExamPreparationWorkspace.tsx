"use client";

/**
 * ============================================================================
 * PRÉPARATION D'EXAMEN — Workspace enseignant (épreuves d'évaluation)
 * ============================================================================
 *
 * ⭐ Module demandé (2026-09-21) — pattern exact « cahier journal → fiches
 *    pédagogiques », appliqué aux épreuves d'évaluation :
 *
 * 1. ONGLET « Évaluations programmées » (SIGNAL) : quand une évaluation est
 *    programmée (module Examens), l'enseignant reçoit l'information ICI :
 *    « telle évaluation est programmée, voici les matières dans lesquelles
 *    les élèves seront évalués — prépare les épreuves de ces matières ».
 *    Identique au pattern FichesAPreparer du cahier journal.
 *
 * 2. ONGLET « Préparation » : éditeur RICHE complet par épreuve (les MÊMES
 *    outils que les fiches pédagogiques : images réalistes, figures de
 *    géométrie, dessin libre, graphiques, tableaux, symboles maths et
 *    LIGNES CALLIGRAPHIQUES script/cursive) + sauvegarde automatique
 *    invisible 10 s + brouillon local + envoi du BLOC à la direction.
 *
 * 3. ONGLET « Catalogue » : épreuves hiérarchisées Classe → Trimestre →
 *    Mois → Sessions (comme le catalogue des cahiers journal / fiches).
 *
 * WORKFLOW (le BLOC entier est transmis, pas chaque épreuve) :
 *    DRAFT → SUBMITTED (directeur) → VALIDATED | REJECTED
 *    → SENT_TO_SECRETARIAT (impression par le secrétariat).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Loader2, RefreshCw, BellRing, PenSquare, Library, Send, CheckCircle2,
  XCircle, Clock, FileDown, ChevronRight, ChevronDown, AlertTriangle,
  NotebookPen, Eye, Printer, Save, BookOpenCheck, Info,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAutoSave, fireKeepaliveSave } from "@/hooks/useAutoSave";
import { AutosaveIndicator } from "@/components/pedagogy/media/AutosaveIndicator";

// ─── Configuration des statuts (pattern fiches) ────────────────────────────

const BLOCK_STATUS: Record<string, { label: string; classes: string; icon: any }> = {
  DRAFT: { label: "Brouillon", classes: "bg-slate-100 text-slate-600 border-slate-200", icon: PenSquare },
  SUBMITTED: { label: "Transmis à la direction", classes: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  VALIDATED: { label: "Validé par la direction", classes: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté par la direction", classes: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  SENT_TO_SECRETARIAT: { label: "Envoyé au secrétariat", classes: "bg-violet-50 text-violet-700 border-violet-200", icon: Printer },
};

const TABS = [
  { id: "signal", label: "Évaluations programmées", icon: BellRing },
  { id: "preparation", label: "Préparation des épreuves", icon: PenSquare },
  { id: "catalogue", label: "Catalogue", icon: Library },
] as const;

type TabId = (typeof TABS)[number]["id"];

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function formatDateFR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Le champ HTML contient-il du texte réel ? */
function hasRealContent(html: string | null | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function ExamPreparationWorkspace() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();

  const [tab, setTab] = useState<TabId>("signal");
  const [loading, setLoading] = useState(true);

  // ─── Résolution teacherId (pattern page exams) ────────────────────────────
  const [teacherId, setTeacherId] = useState<string>("");
  useEffect(() => {
    if (!user?.id) return;
    setTeacherId((user as any).teacherId || user.id);
  }, [user?.id, (user as any).teacherId]);

  // ─── Données ──────────────────────────────────────────────────────────────
  const [pending, setPending] = useState<any>(null); // { sessions, stats }
  const [blocks, setBlocks] = useState<any[]>([]);
  const [catalogue, setCatalogue] = useState<any>(null);

  // ─── Préparation : bloc sélectionné + épreuve en édition ──────────────────
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);

  // ─── Brouillon local (filet anti-perte, pattern fiches-fix) ───────────────
  const [recoveredDraft, setRecoveredDraft] = useState<any | null>(null);
  const draftKey = useMemo(
    () => (tenant?.id && teacherId && selectedSheetId)
      ? `ah-epreuve-draft:${tenant.id}:${teacherId}:${selectedSheetId}` : null,
    [tenant?.id, teacherId, selectedSheetId],
  );

  // ═════════════════════════════════════════════════════════════════════════
  // CHARGEMENTS
  // ═════════════════════════════════════════════════════════════════════════

  const loadPending = useCallback(async () => {
    if (!teacherId || !academicYear?.id) return;
    try {
      const res = await fetch(
        `/api/exam-preparation/pending?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${academicYear.id}`,
        { credentials: "include" },
      );
      if (res.ok) setPending(await res.json());
    } catch { /* silent */ }
  }, [teacherId, academicYear?.id]);

  const loadBlocks = useCallback(async () => {
    if (!teacherId || !academicYear?.id) return;
    try {
      const res = await fetch(
        `/api/exam-preparation/blocks?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${academicYear.id}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setBlocks(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [teacherId, academicYear?.id]);

  const loadCatalogue = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (teacherId) params.set("teacherId", teacherId);
      const res = await fetch(`/api/exam-preparation/catalogue?${params.toString()}`, { credentials: "include" });
      if (res.ok) setCatalogue(await res.json());
    } catch { /* silent */ }
  }, [teacherId, academicYear?.id]);

  const loadBlock = useCallback(async (blockId: string, selectSheet?: string) => {
    setBlockLoading(true);
    try {
      const res = await fetch(`/api/exam-preparation/blocks/${blockId}`, { credentials: "include" });
      if (res.ok) {
        const block = await res.json();
        setSelectedBlock(block);
        const sheets = block.sheets || [];
        if (selectSheet) setSelectedSheetId(selectSheet);
        else if (!selectedSheetId || !sheets.some((s: any) => s.id === selectedSheetId)) {
          setSelectedSheetId(sheets[0]?.id || null);
        }
      } else {
        toast.error("Impossible de charger le bloc d'épreuves");
      }
    } catch {
      toast.error("Erreur réseau lors du chargement du bloc");
    } finally {
      setBlockLoading(false);
    }
  }, [selectedSheetId]);

  // Chargement initial + à chaque changement d'onglet (fraîcheur des données)
  useEffect(() => {
    if (!teacherId || !academicYear?.id) return;
    setLoading(true);
    const run = async () => {
      await Promise.all([loadPending(), loadBlocks(), loadCatalogue()]);
      setLoading(false);
    };
    void run();
  }, [teacherId, academicYear?.id, loadPending, loadBlocks, loadCatalogue]);

  useEffect(() => {
    if (tab === "signal") void loadPending();
    if (tab === "preparation") void loadBlocks();
    if (tab === "catalogue") void loadCatalogue();
  }, [tab, loadPending, loadBlocks, loadCatalogue]);

  // ═════════════════════════════════════════════════════════════════════════
  // ACTIONS — préparer une session (création du bloc + squelettes d'épreuves)
  // ═════════════════════════════════════════════════════════════════════════

  const prepareSession = async (session: any) => {
    if (!teacherId || !academicYear?.id) return;
    // Bloc déjà existant → l'ouvrir directement
    if (session.block?.id) {
      setTab("preparation");
      await loadBlock(session.block.id);
      return;
    }
    try {
      const res = await fetch("/api/exam-preparation/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          academicYearId: academicYear.id,
          classId: session.classId,
          evaluationTypeId: session.evaluationTypeId || "",
          periodId: session.periodId || "",
          evaluationIds: session.matieres.map((m: any) => m.evaluationId),
          title: session.title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Impossible de créer le bloc d'épreuves");
        return;
      }
      toast.success(`Bloc créé — ${session.matieres.length} épreuve(s) à préparer`);
      setTab("preparation");
      await loadBlock(data.id, data.sheets?.[0]?.id);
      void loadPending();
    } catch {
      toast.error("Erreur réseau lors de la création du bloc");
    }
  };

  // ⭐ V11 (retour utilisateur) : chaque matière de l'onglet « Évaluations
  //    programmées » est CLIQUABLE — ouverture DIRECTE de l'éditeur de
  //    l'épreuve de cette matière, sans passer par le bouton principal.
  //    • épreuve déjà créée     → ouverture directe sur cette épreuve
  //    • bloc absent/incomplet  → POST idempotent (crée le bloc au besoin et
  //      complète les squelettes manquants) puis sélection de la matière
  const prepareMatiere = async (session: any, matiere: any) => {
    if (!teacherId || !academicYear?.id) return;
    // Épreuve déjà créée et rattachée → ouverture directe
    if (session.block?.id && matiere.epreuveId) {
      setTab("preparation");
      await loadBlock(session.block.id, matiere.epreuveId);
      return;
    }
    try {
      const res = await fetch("/api/exam-preparation/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          academicYearId: academicYear.id,
          classId: session.classId,
          evaluationTypeId: session.evaluationTypeId || "",
          periodId: session.periodId || "",
          evaluationIds: session.matieres.map((m: any) => m.evaluationId),
          title: session.title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Impossible d'ouvrir la préparation");
        return;
      }
      const target = (data.sheets || []).find((sh: any) => sh.evaluationId === matiere.evaluationId);
      setTab("preparation");
      await loadBlock(data.id, target?.id || data.sheets?.[0]?.id);
      void loadPending();
      void loadBlocks();
    } catch {
      toast.error("Erreur réseau lors de l'ouverture de la préparation");
    }
  };

  if (!academicYear?.id || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const stats = pending?.stats || { totalSessions: 0, totalEpreuves: 0, epreuvesPreparees: 0, epreuvesManquantes: 0 };
  const missingBadge = stats.epreuvesManquantes > 0;

  return (
    <div className="space-y-4">
      {/* ─── En-tête + onglets ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <NotebookPen className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Préparation d&apos;examen</h2>
              <p className="text-xs text-slate-500">
                Épreuves d&apos;évaluation — signal, préparation par matière, validation et envoi au secrétariat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {missingBadge && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {stats.epreuvesManquantes} épreuve(s) à préparer
              </span>
            )}
            <button
              onClick={() => { void loadPending(); void loadBlocks(); void loadCatalogue(); }}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Rafraîchir"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto bg-white">
          {TABS.map((t) => {
            const Icon = t.icon;
            const badge =
              t.id === "signal" && stats.epreuvesManquantes > 0 ? stats.epreuvesManquantes
              : t.id === "preparation" && blocks.filter((b: any) => b.status === "DRAFT").length > 0
                ? blocks.filter((b: any) => b.status === "DRAFT").length
              : null;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap transition-all border-b-2",
                  tab === t.id
                    ? "text-blue-600 border-blue-600 bg-blue-50/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {badge != null && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Contenu des onglets ───────────────────────────────────────────── */}
      {tab === "signal" && (
        <SignalTab
          pending={pending}
          onPrepare={prepareSession}
          onOpenBlock={(id) => { setTab("preparation"); void loadBlock(id); }}
          onPrepareMatiere={(session, matiere) => { void prepareMatiere(session, matiere); }}
        />
      )}
      {tab === "preparation" && (
        <PreparationTab
          blocks={blocks}
          selectedBlock={selectedBlock}
          selectedSheetId={selectedSheetId}
          blockLoading={blockLoading}
          teacherId={teacherId}
          onSelectBlock={loadBlock}
          onSelectSheet={setSelectedSheetId}
          onRefresh={() => { void loadBlocks(); void loadPending(); void loadCatalogue(); }}
          onReloadBlock={(id, sheetId) => loadBlock(id, sheetId)}
          draftKey={draftKey}
          recoveredDraft={recoveredDraft}
          setRecoveredDraft={setRecoveredDraft}
        />
      )}
      {tab === "catalogue" && (
        <CatalogueTab catalogue={catalogue} onOpenBlock={(id) => { setTab("preparation"); void loadBlock(id); }} />
      )}
    </div>
  );
}

// ============================================================================
// ONGLET 1 — SIGNAL : évaluations programmées → épreuves à préparer
// ============================================================================

function SignalTab({
  pending, onPrepare, onOpenBlock, onPrepareMatiere,
}: {
  pending: any;
  onPrepare: (session: any) => void;
  onOpenBlock: (blockId: string) => void;
  /** ⭐ Chaque matière est cliquable : ouvre DIRECTEMENT l'épreuve de cette matière. */
  onPrepareMatiere: (session: any, matiere: any) => void;
}) {
  const sessions: any[] = pending?.sessions || [];
  const stats = pending?.stats;

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <BookOpenCheck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Aucune évaluation programmée pour vos classes</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Quand la direction programme une évaluation (module Examens &amp; Notes), le signal apparaît
          ici avec les matières à préparer — exactement comme le cahier journal détecte les fiches
          pédagogiques à préparer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bandeau résumé */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <BellRing className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-900 font-medium flex-1 min-w-52">
          {stats.totalSessions} évaluation(s) programmée(s) — {stats.totalEpreuves} épreuve(s) au total,{" "}
          <b>{stats.epreuvesPreparees} préparée(s)</b>,{" "}
          <b className={stats.epreuvesManquantes > 0 ? "text-amber-700" : ""}>{stats.epreuvesManquantes} à préparer</b>.
        </p>
      </div>

      {sessions.map((s: any) => {
        const blockStatus = s.block?.status;
        const allPrepared = s.toutesEpreuvesPreparees;
        return (
          <div key={s.sessionKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* En-tête session */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">{s.className}</span>
                  <span className="text-sm font-bold text-slate-800">{s.title}</span>
                  {s.monthLabel && <span className="text-xs text-slate-500">• {s.monthLabel}</span>}
                  {s.trimesterLabel && <span className="text-xs text-slate-400">({s.trimesterLabel})</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Évaluation du {formatDateFR(s.examDate)} — {s.totalEpreuves} matière(s) évaluée(s)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {blockStatus && BLOCK_STATUS[blockStatus] && (
                  <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-bold", BLOCK_STATUS[blockStatus].classes)}>
                    {(() => { const I = BLOCK_STATUS[blockStatus].icon; return <I className="h-3 w-3" /> })()}
                    {BLOCK_STATUS[blockStatus].label}
                  </span>
                )}
                {s.block?.id && blockStatus !== "DRAFT" ? (
                  <button
                    onClick={() => onOpenBlock(s.block.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" /> Consulter
                  </button>
                ) : (
                  <button
                    onClick={() => onPrepare(s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm",
                      allPrepared
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-amber-600 text-white hover:bg-amber-700",
                    )}
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    {s.block?.id ? "Continuer la préparation" : `Préparer les ${s.totalEpreuves} épreuve(s)`}
                  </button>
                )}
              </div>
            </div>

            {/* Matières évaluées (le système dit QUOI préparer)
                ⭐ V11 : chaque matière est CLIQUABLE — ouvre directement
                l'éditeur de l'épreuve de cette matière, sans passer par le
                bouton principal. */}
            <div className="px-4 py-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                Matières dans lesquelles les élèves seront évalués — cliquer sur une matière pour préparer son épreuve
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {s.matieres.map((m: any) => (
                  <button
                    key={m.evaluationId}
                    onClick={() => onPrepareMatiere(s, m)}
                    title={m.epreuvePreparee
                      ? `Ouvrir l'épreuve de ${m.subjectName}`
                      : `Préparer l'épreuve de ${m.subjectName}`}
                    className={cn(
                      "group flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99]",
                      m.epreuvePreparee
                        ? "bg-emerald-50/60 border-emerald-200 hover:border-emerald-400"
                        : "bg-amber-50/60 border-amber-200 hover:border-amber-400 hover:bg-amber-50",
                    )}
                  >
                    <span className="font-semibold text-slate-700 truncate">{m.subjectName}</span>
                    <span className={cn(
                      "flex-shrink-0 text-[10px] font-bold inline-flex items-center gap-1",
                      m.epreuvePreparee ? "text-emerald-600" : "text-amber-600 group-hover:translate-x-0.5 transition-transform",
                    )}>
                      {m.epreuvePreparee ? (
                        <><CheckCircle2 className="h-3 w-3" /> Épreuve préparée</>
                      ) : (
                        <><PenSquare className="h-3 w-3" /> À préparer</>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// ONGLET 2 — PRÉPARATION : blocs + éditeur riche d'épreuve + autosave
// ============================================================================

function PreparationTab({
  blocks, selectedBlock, selectedSheetId, blockLoading, teacherId,
  onSelectBlock, onSelectSheet, onRefresh, onReloadBlock,
  draftKey, recoveredDraft, setRecoveredDraft,
}: {
  blocks: any[];
  selectedBlock: any;
  selectedSheetId: string | null;
  blockLoading: boolean;
  teacherId: string;
  onSelectBlock: (blockId: string) => void;
  onSelectSheet: (sheetId: string) => void;
  onRefresh: () => void;
  onReloadBlock: (blockId: string, sheetId?: string) => void;
  draftKey: string | null;
  recoveredDraft: any | null;
  setRecoveredDraft: (d: any) => void;
}) {
  if (!selectedBlock) {
    return <BlocksList blocks={blocks} onSelect={onSelectBlock} onRefresh={onRefresh} teacherId={teacherId} />;
  }
  return (
    <BlockDetail
      block={selectedBlock}
      selectedSheetId={selectedSheetId}
      blockLoading={blockLoading}
      teacherId={teacherId}
      onBack={() => { onRefresh(); }}
      onReloadBlock={onReloadBlock}
      onSelectSheet={onSelectSheet}
      draftKey={draftKey}
      recoveredDraft={recoveredDraft}
      setRecoveredDraft={setRecoveredDraft}
    />
  );
}

// ─── Liste des blocs ────────────────────────────────────────────────────────

function BlocksList({ blocks, onSelect, onRefresh, teacherId }: {
  blocks: any[]; onSelect: (id: string) => void; onRefresh: () => void; teacherId: string;
}) {
  if (blocks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <NotebookPen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Aucun bloc d&apos;épreuves pour le moment</p>
        <p className="text-xs text-slate-400 mt-1">
          Commencez par l&apos;onglet « Évaluations programmées » : le système vous indique les épreuves à préparer.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {blocks.map((b: any) => {
        const st = BLOCK_STATUS[b.status] || BLOCK_STATUS.DRAFT;
        const StIcon = st.icon;
        const filled = Math.min(b.sheetsCount || 0, Math.max(0, b.sheetsCount - (b.sheetsCount - (b.sheetsFilled ?? 0))));
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">{b.className}</span>
                  {b.monthLabel && <span className="text-[10px] text-slate-400">{b.monthLabel}</span>}
                </div>
                <p className="text-sm font-bold text-slate-800 truncate mt-1">{b.title || "Évaluation"}</p>
              </div>
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold flex-shrink-0", st.classes)}>
                <StIcon className="h-3 w-3" /> {st.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{b.sheetsCount || 0} épreuve(s) • {b.trimesterLabel || "—"}</span>
              <span>{formatDateFR(b.examDate)}</span>
            </div>
            {b.rejectionReason && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2 py-1 line-clamp-2">
                Motif du rejet : {b.rejectionReason}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Détail d'un bloc (en-tête workflow + sélection épreuve + éditeur) ──────

function BlockDetail({
  block, selectedSheetId, blockLoading, teacherId, onBack, onReloadBlock, onSelectSheet,
  draftKey, recoveredDraft, setRecoveredDraft,
}: {
  block: any;
  selectedSheetId: string | null;
  blockLoading: boolean;
  teacherId: string;
  onBack: () => void;
  onReloadBlock: (blockId: string, sheetId?: string) => void;
  onSelectSheet: (sheetId: string) => void;
  draftKey: string | null;
  recoveredDraft: any | null;
  setRecoveredDraft: (d: any) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const sheets: any[] = block.sheets || [];
  const sheet = sheets.find((s: any) => s.id === selectedSheetId) || sheets[0] || null;
  const isDraft = block.status === "DRAFT" || block.status === "REJECTED";

  // ─── Actions workflow ────────────────────────────────────────────────────
  const submitBlock = async () => {
    setActionLoading("submit");
    try {
      const res = await fetch(`/api/exam-preparation/blocks/${block.id}/submit`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.message || "Envoi impossible"); return; }
      toast.success("Bloc d'épreuves transmis à la direction pour validation");
      onReloadBlock(block.id);
      onBack();
    } catch { toast.error("Erreur réseau"); } finally { setActionLoading(null); }
  };

  const sendToSecretariat = async () => {
    setActionLoading("secretariat");
    try {
      const res = await fetch(`/api/exam-preparation/blocks/${block.id}/send-to-secretariat`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.message || "Envoi impossible"); return; }
      toast.success("Épreuves envoyées au secrétariat pour impression");
      onReloadBlock(block.id);
    } catch { toast.error("Erreur réseau"); } finally { setActionLoading(null); }
  };

  const st = BLOCK_STATUS[block.status] || BLOCK_STATUS.DRAFT;
  const StIcon = st.icon;

  return (
    <div className="space-y-3">
      {blockLoading && (
        <div className="flex items-center justify-center py-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* En-tête du bloc + workflow */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={onBack}
              className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-shrink-0"
              title="Retour à la liste"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">{block.className}</span>
                <span className="text-sm font-bold text-slate-800">{block.title || "Évaluation"}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {block.trimesterLabel || "—"} • {block.monthLabel || "—"} • Évaluation du {formatDateFR(block.examDate)} •{" "}
                {sheets.length} épreuve(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold", st.classes)}>
              <StIcon className="h-3.5 w-3.5" /> {st.label}
            </span>
            <a
              href={`/api/exam-preparation/blocks/${block.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              title="Aperçu PDF professionnel (une page par matière)"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
            {block.status === "DRAFT" && (
              <button
                onClick={submitBlock}
                disabled={actionLoading === "submit"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {actionLoading === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer le bloc à la direction
              </button>
            )}
            {block.status === "REJECTED" && (
              <button
                onClick={submitBlock}
                disabled={actionLoading === "submit"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {actionLoading === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Renvoyer à la direction
              </button>
            )}
            {block.status === "VALIDATED" && (
              <button
                onClick={sendToSecretariat}
                disabled={actionLoading === "secretariat"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-sm disabled:opacity-50"
              >
                {actionLoading === "secretariat" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Envoyer au secrétariat
              </button>
            )}
          </div>
        </div>

        {/* Motif de rejet */}
        {block.status === "REJECTED" && block.rejectionReason && (
          <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-700">Bloc rejeté par la direction</p>
              <p className="text-xs text-red-600">{block.rejectionReason}</p>
              <p className="text-[11px] text-red-400 mt-0.5">Corrigez les épreuves puis renvoyez le bloc.</p>
            </div>
          </div>
        )}
        {block.status === "SUBMITTED" && (
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Bloc transmis à la direction le {block.submittedAt ? new Date(block.submittedAt).toLocaleString("fr-FR") : "—"} — en attente de validation.
              Vous serez notifié dès la décision.
            </p>
          </div>
        )}
        {block.status === "SENT_TO_SECRETARIAT" && (
          <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
            <Printer className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <p className="text-xs text-violet-700">
              Envoyé au secrétariat le {block.sentToSecretariatAt ? new Date(block.sentToSecretariatAt).toLocaleString("fr-FR") : "—"} —
              le secrétariat peut visualiser et imprimer les épreuves.
            </p>
          </div>
        )}
        {block.directorObservation && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-start gap-2">
            <Info className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-700"><b>Observation de la direction :</b> {block.directorObservation}</p>
          </div>
        )}

        {/* Sélecteur d'épreuves (une par matière) */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/60">
          <span className="text-[11px] font-bold text-slate-500 uppercase flex-shrink-0 mr-1">Épreuves :</span>
          {sheets.map((s: any) => {
            const filled = hasRealContent(s.situation) || hasRealContent(s.consignes);
            const active = sheet?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSheet(s.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0",
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : filled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300",
                )}
              >
                {filled ? <CheckCircle2 className="h-3 w-3" /> : <PenSquare className="h-3 w-3" />}
                {s.subjectName || "Épreuve"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Éditeur de l'épreuve sélectionnée */}
      {sheet ? (
        <EpreuveEditor
          sheet={sheet}
          block={block}
          isDraft={isDraft}
          onSaved={() => onReloadBlock(block.id, sheet.id)}
          draftKey={draftKey}
          recoveredDraft={recoveredDraft}
          setRecoveredDraft={setRecoveredDraft}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Aucune épreuve dans ce bloc.
        </div>
      )}
    </div>
  );
}

// ─── Éditeur d'épreuve (structure conforme aux modèles officiels) ──────────

const EMPTY_FORM = {
  epreuveTitle: "",
  durationLabel: "",
  maxScoreLabel: "",
  coefficient: "",
  showIdentityFields: true,
  situation: "",
  tache: "",
  consignes: "",
  cleCorrection: "",
  grilleCorrection: "",
};

function EpreuveEditor({
  sheet, block, isDraft, onSaved, draftKey, recoveredDraft, setRecoveredDraft,
}: {
  sheet: any;
  block: any;
  isDraft: boolean;
  onSaved: () => void;
  draftKey: string | null;
  recoveredDraft: any | null;
  setRecoveredDraft: (d: any) => void;
}) {
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [showCorrection, setShowCorrection] = useState(
    !!(sheet?.cleCorrection || sheet?.grilleCorrection),
  );

  // Chargement initial de l'épreuve dans le formulaire
  useEffect(() => {
    setForm({
      epreuveTitle: sheet.epreuveTitle || `Épreuve de ${(sheet.subjectName || "—").toUpperCase()}`,
      durationLabel: sheet.durationLabel || "1h",
      maxScoreLabel: sheet.maxScoreLabel || "",
      coefficient: sheet.coefficient || "",
      showIdentityFields: sheet.showIdentityFields !== false,
      situation: sheet.situation || "",
      tache: sheet.tache || "",
      consignes: sheet.consignes || "",
      cleCorrection: sheet.cleCorrection || "",
      grilleCorrection: sheet.grilleCorrection || "",
    });
    setShowCorrection(!!(sheet.cleCorrection || sheet.grilleCorrection));
    // Détection d'un brouillon local non sauvegardé (filet anti-perte)
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft && (hasRealContent(draft.situation) || hasRealContent(draft.consignes))
            && (draft.situation !== (sheet.situation || "") || draft.consignes !== (sheet.consignes || ""))) {
            setRecoveredDraft(draft);
          }
        }
      } catch { /* silent */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id]);

  // ─── Brouillon local continu (throttle 800 ms — pattern fiches-fix) ──────
  const draftTimer = useRef<any>(null);
  useEffect(() => {
    if (!draftKey || !isDraft) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* quota */ }
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [form, draftKey, isDraft]);

  const purgeDraft = useCallback(() => {
    if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* silent */ } }
    setRecoveredDraft(null);
  }, [draftKey, setRecoveredDraft]);

  const applyDraft = () => {
    if (!recoveredDraft) return;
    setForm((p: any) => ({ ...p, ...recoveredDraft }));
    setRecoveredDraft(null);
    toast.info("Saisie récupérée — pensez à enregistrer");
  };

  // ─── Sauvegarde (manuelle + automatique) ─────────────────────────────────
  const saveUrl = `/api/exam-preparation/sheets/${sheet.id}`;
  const buildBody = (src: string) => ({ ...form, __source: src });

  const { status, lastSavedAt, saveNow, markSaved } = useAutoSave({
    snapshot: JSON.stringify(form),
    enabled: isDraft,
    save: async () => {
      const res = await fetch(`${saveUrl}?source=autosave`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody("autosave")),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
    },
    unloadSave: () => fireKeepaliveSave(`${saveUrl}?source=autosave`, "PUT", buildBody("autosave")),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(saveUrl, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody("manual")),
      });
      if (res.ok) {
        markSaved();
        purgeDraft();
        toast.success("Épreuve enregistrée");
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "Erreur lors de l\'enregistrement");
      }
    } catch {
      toast.error("Erreur réseau lors de l\'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // ─── Champs ───────────────────────────────────────────────────────────────
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Bandeau de récupération du brouillon */}
      {recoveredDraft && isDraft && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 flex-1 min-w-40">
            Une saisie non enregistrée de cette épreuve a été retrouvée localement.
          </p>
          <button onClick={applyDraft} className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700">
            Reprendre la saisie
          </button>
          <button onClick={purgeDraft} className="px-2.5 py-1 rounded-md border border-amber-300 text-amber-700 text-[11px] font-semibold hover:bg-amber-100">
            Ignorer
          </button>
        </div>
      )}

      {/* En-tête épreuve : aperçu du format officiel + champs rapides */}
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              {block.className} • {(block.title || "ÉVALUATION").toUpperCase()} • {block.monthLabel}
            </div>
            <input
              type="text"
              value={form.epreuveTitle || ""}
              onChange={(e) => set("epreuveTitle", e.target.value)}
              disabled={!isDraft}
              className="text-base font-bold text-slate-800 bg-transparent border-0 border-b border-transparent focus:border-blue-300 focus:outline-none px-0 py-0.5 w-full max-w-md"
              placeholder="Épreuve de LECTURE"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />
            {isDraft && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </button>
            )}
            <a
              href={`/api/exam-preparation/sheets/${sheet.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              title="Aperçu PDF de cette épreuve"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
          </div>
        </div>

        {/* Champs d'entête (durée, barème, coefficient, champs Nom/Prénoms) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <HeaderField label="Durée" value={form.durationLabel} onChange={(v) => set("durationLabel", v)} disabled={!isDraft} placeholder="1h" />
          <HeaderField label="Barème" value={form.maxScoreLabel} onChange={(v) => set("maxScoreLabel", v)} disabled={!isDraft} placeholder="10 pts" />
          <HeaderField label="Coefficient" value={form.coefficient} onChange={(v) => set("coefficient", v)} disabled={!isDraft} placeholder="1" />
          <label className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs", isDraft ? "border-slate-200 cursor-pointer" : "border-slate-100 bg-slate-50 opacity-70")}>
            <input
              type="checkbox"
              checked={form.showIdentityFields !== false}
              onChange={(e) => set("showIdentityFields", e.target.checked)}
              disabled={!isDraft}
              className="rounded border-slate-300"
            />
            <span className="text-slate-600 font-medium">Champs Nom / Prénoms</span>
          </label>
        </div>
      </div>

      {!isDraft && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[11px] text-slate-500">
            Bloc {block.status === "SUBMITTED" ? "transmis à la direction" : block.status === "VALIDATED" ? "validé" : "envoyé au secrétariat"} — épreuve en lecture seule.
          </p>
        </div>
      )}

      {/* Corps : sections riches (mêmes outils que les fiches pédagogiques) */}
      <div className="p-4 space-y-4">
        <RichSection
          label="Situation d'évaluation"
          hint="Contexte de la situation (ex : « Dans nos maisons, il y a des insectes qui nous dérangent… »)"
          value={form.situation}
          onChange={(html) => set("situation", html)}
          disabled={!isDraft}
        />
        <RichSection
          label="Tâche"
          hint="Ce que l'élève doit faire (ex : « Lis le texte et réponds aux items »)"
          value={form.tache}
          onChange={(html) => set("tache", html)}
          disabled={!isDraft}
        />
        <RichSection
          label="Consigne / Items"
          hint="Items numérotés, exercices, questions… insérez images, figures, tableaux, symboles maths et lignes calligraphiques (graphisme)"
          value={form.consignes}
          onChange={(html) => set("consignes", html)}
          disabled={!isDraft}
          minHeight="160px"
          maxHeight="none"
        />

        {/* Clé + grille de correction (repliables) */}
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={() => setShowCorrection(!showCorrection)}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600"
          >
            {showCorrection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Clé &amp; grille de correction <span className="font-normal text-slate-400">(facultatif — pages séparées dans le PDF enseignant)</span>
          </button>
          {showCorrection && (
            <div className="mt-3 space-y-4">
              <RichSection
                label="Clé de correction"
                hint="Corrigé détaillé par item avec barème (ex : « Item 1 : 6pts — a) le titre 1,5pt… »)"
                value={form.cleCorrection}
                onChange={(html) => set("cleCorrection", html)}
                disabled={!isDraft}
                minHeight="120px"
                maxHeight="none"
              />
              <RichSection
                label="Grille de correction"
                hint="Grille critériée (critères, niveaux, points — tableau insérable)"
                value={form.grilleCorrection}
                onChange={(html) => set("grilleCorrection", html)}
                disabled={!isDraft}
                minHeight="120px"
                maxHeight="none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Petit champ d'entête (durée, barème…). */
function HeaderField({ label, value, onChange, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg border", disabled ? "border-slate-100 bg-slate-50" : "border-slate-200")}>
      <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">{label}</span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs font-semibold text-slate-700 focus:outline-none placeholder:text-slate-300"
      />
    </div>
  );
}

/** Section riche avec RichTextEditor (tous les outils des fiches). */
function RichSection({ label, hint, value, onChange, disabled, minHeight = "80px", maxHeight = "none" }: {
  label: string; hint?: string; value: string; onChange: (html: string) => void;
  disabled?: boolean; minHeight?: string; maxHeight?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        {hint && <span className="text-[10px] text-slate-400 truncate">{hint}</span>}
      </div>
      <div className={cn("rounded-lg border overflow-hidden", disabled ? "border-slate-200" : "border-slate-300 focus-within:ring-1 focus-within:ring-blue-400")}>
        <RichTextEditor
          value={value}
          onChange={onChange}
          disabled={disabled}
          enableMedia={!disabled}
          minHeight={minHeight}
          maxHeight={maxHeight}
          editorClassName="text-sm"
        />
      </div>
    </div>
  );
}

// ============================================================================
// ONGLET 3 — CATALOGUE hiérarchisé : Classe → Trimestre → Mois → Sessions
// ============================================================================

function CatalogueTab({ catalogue, onOpenBlock }: {
  catalogue: any;
  onOpenBlock: (blockId: string) => void;
}) {
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [openTri, setOpenTri] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const classes: any[] = catalogue?.classes || [];

  if (classes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Library className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Catalogue vide</p>
        <p className="text-xs text-slate-400 mt-1">Les épreuves préparées apparaîtront ici, hiérarchisées par classe, trimestre et mois.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Library className="h-4 w-4 text-slate-400" />
        <p className="text-xs font-bold text-slate-600">
          Catalogue des épreuves <span className="font-normal text-slate-400">— {catalogue?.total || 0} bloc(s), hiérarchisés par classe, trimestre et mois</span>
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {classes.map((c: any) => {
          const classKey = c.classId;
          const classOpen = openClass === classKey;
          return (
            <div key={classKey}>
              <button
                onClick={() => { setOpenClass(classOpen ? null : classKey); setOpenTri(null); setOpenMonth(null); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-left"
              >
                {classOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px] font-bold">{c.className}</span>
                <span className="text-[11px] text-slate-400">{c.trimestres.length} trimestre(s)</span>
              </button>
              {classOpen && (
                <div className="pl-8 pr-4 pb-2">
                  {c.trimestres.map((t: any) => {
                    const triKey = `${classKey}|${t.trimesterLabel}`;
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
                                    <div className="pl-5 space-y-1.5 pb-2">
                                      {m.blocs.map((b: any) => {
                                        const st = BLOCK_STATUS[b.status] || BLOCK_STATUS.DRAFT;
                                        return (
                                          <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50">
                                            <div className="min-w-0">
                                              <p className="text-xs font-bold text-slate-700 truncate">{b.title || "Évaluation"}</p>
                                              <p className="text-[10px] text-slate-400 truncate">
                                                {b.subjectsLabel || `${b.sheetsCount} épreuve(s)`} • {formatDateFR(b.examDate)}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold", st.classes)}>{st.label}</span>
                                              <a
                                                href={`/api/exam-preparation/blocks/${b.id}/export-pdf`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-md text-slate-400 hover:bg-white hover:text-blue-600"
                                                title="PDF du bloc"
                                              >
                                                <FileDown className="h-3.5 w-3.5" />
                                              </a>
                                              <button
                                                onClick={() => onOpenBlock(b.id)}
                                                className="p-1.5 rounded-md text-slate-400 hover:bg-white hover:text-blue-600"
                                                title="Ouvrir"
                                              >
                                                <Eye className="h-3.5 w-3.5" />
                                              </button>
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
    </div>
  );
}
