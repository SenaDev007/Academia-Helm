"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL & FICHES PÉDAGOGIQUES — Container unifié
 * ============================================================================
 *
 * Container qui regroupe le Cahier Journal (grille hebdo 5j × matières) ET
 * les Fiches Pédagogiques associées dans une vue à 2 sous-onglets :
 *
 *   1. "Cahier Journal" — la grille hebdo (composant CahierJournalTab)
 *   2. "Fiches Pédagogiques" — liste des fiches rattachées au cahier journal
 *      courant + boutons "Préparer la fiche" par matière planifiée
 *
 * ⭐ Flow automatique : quand l'enseignant enregistre ou soumet son cahier
 *    journal, le système bascule automatiquement vers le sous-onglet Fiches
 *    et lui montre la liste des matières planifiées sans fiche pédagogique.
 *
 * ⭐ Hiérarchie : CahierJournal(week) → Jour → Matière → Fiche
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  CalendarDays,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { CahierJournalTab } from "./CahierJournalTab";
import { PedagogicalSheetsTab } from "./PedagogicalSheetsTab";

type SubTab = "cahier" | "fiches";

interface CahierJournalFichesContainerProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function CahierJournalFichesContainer({
  tenantId,
  academicYearId,
  teacherId,
}: CahierJournalFichesContainerProps) {
  const [subTab, setSubTab] = useState<SubTab>("cahier");
  const [currentJournalId, setCurrentJournalId] = useState<string | null>(null);
  const [currentJournalMeta, setCurrentJournalMeta] = useState<{
    weekStartDate?: string;
    weekEndDate?: string;
    className?: string;
    status?: string;
  } | null>(null);
  const [pendingInitialPayload, setPendingInitialPayload] = useState<{
    day?: string;
    matiere?: string;
    sheetType?: string;
  } | null>(null);

  // Quand CahierJournalTab appelle onJournalSaved/onJournalSubmitted avec
  // l'ID du cahier journal, on bascule vers le sous-onglet fiches.
  const handleJournalSaved = useCallback(
    (journalId: string, meta?: any) => {
      setCurrentJournalId(journalId);
      if (meta) setCurrentJournalMeta(meta);
      // ⭐ Bascule automatique vers sous-onglet Fiches
      setSubTab("fiches");
      toast.success("Cahier journal enregistré", {
        description: "Vérifiez maintenant les fiches pédagogiques à préparer.",
      });
    },
    [],
  );

  const handleJournalSubmitted = useCallback(
    (journalId: string, meta?: any) => {
      setCurrentJournalId(journalId);
      if (meta) setCurrentJournalMeta(meta);
      setSubTab("fiches");
    },
    [],
  );

  // L'utilisateur clique sur "Préparer la fiche pour [jour] [matière]"
  // On bascule vers l'onglet Fiches avec un payload initial
  const handlePrepareFicheFor = useCallback(
    (day: string, matiere: string, sheetType?: string) => {
      setPendingInitialPayload({ day, matiere, sheetType });
      setSubTab("fiches");
    },
    [],
  );

  return (
    <div className="space-y-4">
      {/* Sous-onglets Cahier Journal ↔ Fiches Pédagogiques */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 rounded-t-lg p-1">
        <button
          onClick={() => setSubTab("cahier")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all",
            subTab === "cahier"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Cahier Journal</span>
        </button>
        <button
          onClick={() => setSubTab("fiches")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all",
            subTab === "fiches"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <FileText className="h-4 w-4" />
          <span>Fiches Pédagogiques</span>
          {currentJournalId && (
            <FichesBadge
              tenantId={tenantId}
              journalId={currentJournalId}
            />
          )}
        </button>

        {currentJournalMeta && (
          <div className="ml-auto text-xs text-slate-500 px-3 hidden sm:flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              Semaine du{" "}
              <strong>
                {currentJournalMeta.weekStartDate
                  ? new Date(currentJournalMeta.weekStartDate).toLocaleDateString("fr-FR")
                  : "—"}
              </strong>
            </span>
            {currentJournalMeta.className && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>{currentJournalMeta.className}</span>
              </>
            )}
            {currentJournalMeta.status && (
              <StatusBadge status={currentJournalMeta.status} />
            )}
          </div>
        )}
      </div>

      {/* Contenu du sous-onglet */}
      <div>
        {subTab === "cahier" && (
          <CahierJournalTab
            tenantId={tenantId}
            academicYearId={academicYearId}
            teacherId={teacherId}
            onJournalSaved={handleJournalSaved}
            onJournalSubmitted={handleJournalSubmitted}
          />
        )}
        {subTab === "fiches" && (
          <>
            {!currentJournalId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-700">
                  Aucun cahier journal sélectionné
                </p>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Pour préparer les fiches pédagogiques, enregistrez d&apos;abord votre cahier journal de la semaine.
                </p>
                <button
                  onClick={() => setSubTab("cahier")}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Aller au Cahier Journal
                </button>
              </div>
            ) : (
              <>
                {/* Liste des matières planifiées + boutons "Préparer la fiche" */}
                <FichesAPreparer
                  tenantId={tenantId}
                  journalId={currentJournalId}
                  onPrepareFiche={handlePrepareFicheFor}
                  onCreateFreeFiche={() => {
                    // ⭐ Bouton "Créer une fiche libre" — ouvre le formulaire
                    //    sans pré-remplissage (l'utilisateur choisit tout)
                    setPendingInitialPayload(null);
                    // On ne fait rien ici — le formulaire PedagogicalSheetsTab
                    // a son propre bouton "+ Nouvelle fiche" qui s'affichera en bas
                    // Scroller vers le formulaire
                    setTimeout(() => {
                      document.getElementById('fiches-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                />
                {/* Formulaire des fiches pédagogiques (pré-rempli si pendingInitialPayload) */}
                <div id="fiches-section" className="mt-6">
                  <PedagogicalSheetsTab
                    tenantId={tenantId}
                    academicYearId={academicYearId}
                    teacherId={teacherId}
                    cahierJournalId={currentJournalId}
                    initialLessonDay={pendingInitialPayload?.day}
                    initialSheetType={pendingInitialPayload?.sheetType}
                    initialMatiere={pendingInitialPayload?.matiere}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Badge nombre de fiches (avec statut manquantes) ────────────────────────

function FichesBadge({
  tenantId,
  journalId,
}: {
  tenantId: string;
  journalId: string;
}) {
  const [stats, setStats] = useState<{
    totalFiches: number;
    totalFichesManquantes: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(
          `/pedagogy-space/cahier-journal/${journalId}/fiches`,
        );
        if (cancelled) return;
        const data = res.data?.stats;
        if (data) {
          setStats({
            totalFiches: data.totalFiches || 0,
            totalFichesManquantes: data.totalFichesManquantes || 0,
          });
        }
      } catch {
        // silent fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, journalId]);

  if (!stats) return null;
  if (stats.totalFichesManquantes > 0) {
    return (
      <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
        {stats.totalFichesManquantes}
      </span>
    );
  }
  if (stats.totalFiches > 0) {
    return (
      <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
        {stats.totalFiches}
      </span>
    );
  }
  return null;
}

// ─── Statut du cahier journal ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Brouillon", className: "bg-slate-100 text-slate-600" },
    SUBMITTED: { label: "Soumis", className: "bg-blue-100 text-blue-700" },
    VALIDATED: { label: "Validé", className: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "Rejeté", className: "bg-red-100 text-red-700" },
  };
  const cfg = map[status] || map.DRAFT;
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-bold rounded-full",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ─── Liste des matières planifiées + boutons "Préparer la fiche" ────────────

function FichesAPreparer({
  tenantId,
  journalId,
  onPrepareFiche,
  onCreateFreeFiche,
}: {
  tenantId: string;
  journalId: string;
  onPrepareFiche: (day: string, matiere: string, sheetType?: string) => void;
  /** ⭐ Callback pour le bouton "Créer une fiche libre" (sans pré-remplissage) */
  onCreateFreeFiche?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/pedagogy-space/cahier-journal/${journalId}/fiches`,
      );
      setData(res.data);
    } catch (e: any) {
      toast.error("Erreur chargement fiches", {
        description: e.message || "Impossible de charger les fiches du cahier journal.",
      });
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement des fiches du cahier journal…
      </div>
    );
  }

  if (!data) return null;

  const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
  const dayLabels: Record<string, string> = {
    lundi: "Lundi",
    mardi: "Mardi",
    mercredi: "Mercredi",
    jeudi: "Jeudi",
    vendredi: "Vendredi",
  };

  const stats = data.stats || {};
  const toutesFichesPreparees = stats.toutesFichesPreparees;

  return (
    <div className="space-y-3">
      {/* Bandeau récapitulatif */}
      <div
        className={cn(
          "rounded-lg border p-4 flex items-center gap-3",
          toutesFichesPreparees
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-200 text-amber-800",
        )}
      >
        {toutesFichesPreparees ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <div className="flex-1">
          <p className="text-sm font-bold">
            {toutesFichesPreparees
              ? "Toutes les fiches pédagogiques sont préparées ✨"
              : `${stats.totalFichesManquantes || 0} fiche(s) pédagogique(s) à préparer`}
          </p>
          <p className="text-xs opacity-80">
            {stats.totalFichesPreparees || 0} / {stats.totalMatieresPlanifiees || 0} matières ont leur fiche · {stats.totalFiches || 0} fiche(s) au total
          </p>
        </div>
        {/* ⭐ Bouton "Créer une fiche libre" — ouvre le formulaire sans pré-remplissage */}
        {onCreateFreeFiche && (
          <button
            onClick={onCreateFreeFiche}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Créer une fiche libre</span>
            <span className="sm:hidden">Fiche libre</span>
          </button>
        )}
      </div>

      {/* Liste par jour */}
      <div className="space-y-3">
        {days.map((day) => {
          const matieres = (data.matieresPlanifiees?.[day] || []) as Array<{
            matiere: string;
            fichePreparede: boolean;
            ficheId?: string;
          }>;
          if (matieres.length === 0) return null;
          const dayComplete = matieres.every((m) => m.fichePreparede);
          return (
            <div
              key={day}
              className={cn(
                "rounded-lg border p-3",
                dayComplete
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-amber-200 bg-amber-50/30",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                  {dayLabels[day] || day}
                </h4>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    dayComplete
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {matieres.filter((m) => m.fichePreparede).length} / {matieres.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {matieres.map((m) => (
                  <div
                    key={`${day}-${m.matiere}`}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-xs",
                      m.fichePreparede
                        ? "border-emerald-200 bg-white"
                        : "border-amber-200 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {m.fichePreparede ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700 truncate capitalize">
                        {m.matiere.replace(/_/g, " ")}
                      </span>
                    </div>
                    {m.fichePreparede ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          // Scroller vers la fiche existante — pour simplifier,
                          // on ouvre le formulaire avec les mêmes params (l'API fera le lien)
                          onPrepareFiche(day, m.matiere);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline ml-2"
                      >
                        Voir
                      </a>
                    ) : (
                      <button
                        onClick={() => onPrepareFiche(day, m.matiere)}
                        className="flex items-center gap-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded ml-2"
                      >
                        <Plus className="h-3 w-3" />
                        Préparer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
