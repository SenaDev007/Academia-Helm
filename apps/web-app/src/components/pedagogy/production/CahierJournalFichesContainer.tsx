"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL & FICHES PÉDAGOGIQUES — Container unifié
 * ============================================================================
 *
 * Container qui regroupe le Cahier Journal (grille hebdo 5j × matières), les
 * Fiches Pédagogiques associées, et le Catalogue des années antérieures dans
 * une vue à 3 sous-onglets :
 *
 *   1. "Cahier Journal" — la grille hebdo (composant CahierJournalTab)
 *   2. "Fiches Pédagogiques" — liste des fiches rattachées au cahier journal
 *      courant + boutons "Préparer la fiche" par matière planifiée
 *   3. "Catalogue" — vue hiérarchique type Explorateur Windows des cahiers
 *      journaux + fiches pédagogiques de TOUTES les années antérieures.
 *      Permet de visualiser + PDF + réutiliser (duplication vers l'année courante).
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
import { usePersistedTab } from "@/hooks/usePersistedTab";
import {
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  CalendarDays,
  Eye,
  Download,
  FolderOpen,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { CahierJournalTab } from "./CahierJournalTab";
import { PedagogicalSheetsTab } from "./PedagogicalSheetsTab";
import { CatalogueTab } from "./CatalogueTab";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import {
  mapMatiereNameToSheetType,
  MAT_LEGACY_LABELS as MAT_MATIERE_LABELS,
} from "@/lib/pedagogy/maternelle-domains";
import { affichageMatiere } from "@/lib/pedagogy/cahier-sous-matieres";

type SubTab = "cahier" | "fiches" | "catalogue";

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
  // ⭐ FIX (demande utilisateur) : persistance du sous-onglet actif
  //    (Cahier Journal / Fiches Pédagogiques / Catalogue) après un
  //    rechargement de page — reflété dans l'URL (?vue=fiches) SANS
  //    rechargement + miroir sessionStorage.
  const [subTab, setSubTab] = usePersistedTab(
    "vue",
    ["cahier", "fiches", "catalogue"] as const,
    "cahier",
  ) as [SubTab, (t: SubTab) => void];
  const [currentJournalId, setCurrentJournalId] = useState<string | null>(null);
  // ⭐ FIX (2026-09-18 — régression "la bascule ne montre plus les fiches à préparer") :
  //    les sous-onglets sont TOUJOURS montés (CSS hidden — commit 150d9bc19) et
  //    FichesAPreparer/FichesBadge/FichesLieesJournal ne se rechargent que quand
  //    journalId CHANGE. Or après un enregistrement, le journalId reste LE MÊME
  //    → les données restaient STALE ("0/0 matières" alors que l'API retourne
  //    les vraies valeurs). journalRefreshKey est incrémenté à CHAQUE
  //    enregistrement/soumission et passé aux consommateurs → re-fetch forcé.
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  // ⭐ Niveau scolaire actif + rôle pour restreindre le Catalogue aux enseignants
  //    Maternelle/Primaire (le Secondaire n'a pas de cahier journal ni fiches).
  const { schoolLevel } = useModuleContext();
  const { user } = useAppSession();
  const schoolLevelCode = (schoolLevel?.code || '').toUpperCase();
  const isSecondaryLevel =
    schoolLevelCode.includes('SECOND') ||
    schoolLevelCode.includes('COLLEGE') ||
    schoolLevelCode.includes('LYCEE');
  const GLOBAL_ACCESS_ROLES = new Set([
    'PROMOTER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN',
  ]);
  const hasGlobalAccess = GLOBAL_ACCESS_ROLES.has((user?.role || '').toUpperCase());
  // ⭐ Le Catalogue n'est visible que pour Maternelle/Primaire OU accès global
  const showCatalogue = !isSecondaryLevel || hasGlobalAccess;
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
    /** ⭐ Sous-matière renseignée dans le cahier journal (ex : « Vocabulaire
     *    thématique ») — pré-remplit le champ dédié de la fiche pédagogique. */
    sousMatiere?: string;
  } | null>(null);
  // ⭐ ClassId récupéré depuis le cahier journal — passé à PedagogicalSheetsTab
  //    pour pré-sélectionner automatiquement la classe
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  // ⭐ ID d'une fiche existante à ouvrir en édition (depuis "Voir la fiche").
  //    Porté par une REQUÊTE {id, nonce} : le nonce garantit que re-cliquer
  //    « Voir » sur la MÊME fiche (après l'avoir refermée) rouvre bien le
  //    formulaire — sinon l'ID ne change pas et l'effet d'ouverture ne se
  //    redéclenche pas (le clic semblait « ne rien faire »).
  const [viewFicheRequest, setViewFicheRequest] = useState<{ id: string | null; nonce: number }>({
    id: null,
    nonce: 0,
  });
  // ⭐ Nonce du payload « Préparer » — même logique : re-cliquer « Préparer »
  //    pour la même (jour × matière × sous-matière) rouvre le formulaire.
  const [pendingPayloadNonce, setPendingPayloadNonce] = useState(0);

  // Quand CahierJournalTab appelle onJournalSaved/onJournalSubmitted avec
  // l'ID du cahier journal, on bascule vers le sous-onglet fiches.
  const handleJournalSaved = useCallback(
    (journalId: string, meta?: any) => {
      setCurrentJournalId(journalId);
      setJournalRefreshKey((k) => k + 1);
      if (meta) {
        setCurrentJournalMeta(meta);
        // ⭐ Récupérer le classId pour le passer à PedagogicalSheetsTab
        if (meta.classId) setCurrentClassId(meta.classId);
      }
      // ⭐ Bascule automatique vers sous-onglet Fiches
      setSubTab("fiches");
      toast.success("Cahier journal enregistré", {
        description: meta?.fichesAPreparerCount
          ? `${meta.fichesAPreparerCount} fiche(s) pédagogique(s) à préparer — vérifiez l'onglet Fiches Pédagogiques.`
          : "Vérifiez maintenant les fiches pédagogiques à préparer.",
      });
    },
    [],
  );

  const handleJournalSubmitted = useCallback(
    (journalId: string, meta?: any) => {
      setCurrentJournalId(journalId);
      setJournalRefreshKey((k) => k + 1);
      if (meta) {
        setCurrentJournalMeta(meta);
        if (meta.classId) setCurrentClassId(meta.classId);
      }
      setSubTab("fiches");
    },
    [],
  );

  // ⭐ Callback appelé après chaque loadJournal réussi (y compris quand on switch de semaine).
  //    Permet de connaître le journalId courant pour afficher les fiches liées
  //    en dessous de la grille hebdo dans le sous-onglet "cahier".
  const handleJournalLoaded = useCallback(
    (journalId: string | null, meta?: any) => {
      if (journalId) {
        setCurrentJournalId(journalId);
        if (meta) {
          setCurrentJournalMeta(prev => ({ ...prev, ...meta }));
          if (meta.classId) setCurrentClassId(meta.classId);
        }
      }
    },
    [],
  );

  // ⭐ Si le Catalogue est masqué (enseignant Secondaire) mais que subTab est
  //    encore "catalogue", on revient à "cahier" pour éviter un écran vide.
  useEffect(() => {
    if (subTab === "catalogue" && !showCatalogue) {
      setSubTab("cahier");
    }
  }, [subTab, showCatalogue]);

  // L'utilisateur clique sur "Préparer la fiche pour [jour] [matière] [sous-matière]"
  // On bascule vers l'onglet Fiches avec un payload initial
  const handlePrepareFicheFor = useCallback(
    (day: string, matiere: string, sheetType?: string, sousMatiere?: string) => {
      setPendingInitialPayload({ day, matiere, sheetType, sousMatiere });
      setPendingPayloadNonce((n) => n + 1);
      setViewFicheRequest({ id: null, nonce: 0 }); // Clear view mode — on veut créer, pas voir
      setSubTab("fiches");
    },
    [],
  );

  // ⭐ L'utilisateur clique sur "Voir la fiche" — ouvre la fiche existante en édition
  //    + demande de DÉFILEMENT vers le début de la fiche (demande promoteur :
  //    « lorsqu'on clique sur le bouton voir, ça puisse nous diriger
  //    spécifiquement là où la fiche commence » — cf. PedagogicalSheetsTab,
  //    effet d'ancrage sur l'ouverture du formulaire).
  const handleViewFiche = useCallback(
    (ficheId: string) => {
      setViewFicheRequest((prev) => ({ id: ficheId, nonce: prev.nonce + 1 }));
      setPendingInitialPayload(null); // Clear prepare mode
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
              refreshKey={journalRefreshKey}
            />
          )}
        </button>
        {/* ⭐ 3e sous-onglet : Catalogue des années antérieures */}
        {/*    Vue hiérarchique type Explorateur Windows : Année → Trimestre → Mois → Semaine */}
        {/*    Masqué pour les enseignants Secondaire (le catalogue ne contient que des */}
        {/*    cahiers journaux + fiches = réservés Maternelle/Primaire). */}
        {showCatalogue && (
          <button
            onClick={() => setSubTab("catalogue")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all",
              subTab === "catalogue"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Catalogue</span>
          </button>
        )}

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

      {/* Contenu du sous-onglet — les deux composants sont TOUJOURS montés
          mais cachés via CSS display:none. Ça évite le rechargement complet
          quand on switch d'onglet (qui causait la lenteur et le chargement infini). */}
      <div>
        <div className={subTab === "cahier" ? "" : "hidden"}>
          <div className="space-y-4">
            <CahierJournalTab
              tenantId={tenantId}
              academicYearId={academicYearId}
              teacherId={teacherId}
              initialClassId={currentClassId || undefined}
              onJournalSaved={handleJournalSaved}
              onJournalSubmitted={handleJournalSubmitted}
              onJournalLoaded={handleJournalLoaded}
            />
            {currentJournalId && (
              <FichesLieesJournal
                journalId={currentJournalId}
                refreshKey={journalRefreshKey}
                onViewFiche={handleViewFiche}
                weekStartDate={currentJournalMeta?.weekStartDate}
                weekEndDate={currentJournalMeta?.weekEndDate}
              />
            )}
          </div>
        </div>
        <div className={subTab === "fiches" ? "" : "hidden"}>
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
                  refreshKey={journalRefreshKey}
                  onPrepareFiche={handlePrepareFicheFor}
                  onViewFiche={handleViewFiche}
                  onCreateFreeFiche={() => {
                    // ⭐ Bouton "Créer une fiche libre" — ouvre le formulaire
                    //    sans pré-remplissage (l'utilisateur choisit tout)
                    setPendingInitialPayload(null);
                    setViewFicheRequest({ id: null, nonce: 0 });
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
                  {/* ⭐ 2026-09-19 : initialWeekStartDate = lundi de la semaine
                      AFFICHÉE dans le cahier journal — la date pré-remplie de la
                      fiche correspond exactement au jour cliqué (plus de « date
                      aléatoire » quand l'enseignant navigue entre les semaines). */}
                  <PedagogicalSheetsTab
                    tenantId={tenantId}
                    academicYearId={academicYearId}
                    teacherId={teacherId}
                    cahierJournalId={currentJournalId}
                    initialClassId={currentClassId || undefined}
                    initialLessonDay={pendingInitialPayload?.day}
                    initialWeekStartDate={currentJournalMeta?.weekStartDate}
                    initialSheetType={pendingInitialPayload?.sheetType}
                    initialMatiere={pendingInitialPayload?.matiere}
                    initialSousMatiere={pendingInitialPayload?.sousMatiere}
                    initialFicheId={viewFicheRequest.id || undefined}
                    initialFicheNonce={viewFicheRequest.nonce}
                    initialPayloadNonce={pendingPayloadNonce}
                  />
                </div>
              </>
            )}
        </div>
        {/* ⭐ 3e sous-onglet : Catalogue des années antérieures */}
        {/*    Le composant est TOUJOURS monté mais caché via CSS pour éviter */}
        {/*    le rechargement du catalogue à chaque switch d'onglet. */}
        {/*    Masqué pour les enseignants Secondaire (showCatalogue=false). */}
        {showCatalogue && (
          <div className={subTab === "catalogue" ? "" : "hidden"}>
            <CatalogueTab
              tenantId={tenantId}
              academicYearId={academicYearId}
              teacherId={teacherId}
              onViewFiche={handleViewFiche}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Badge nombre de fiches (avec statut manquantes) ────────────────────────

function FichesBadge({
  tenantId,
  journalId,
  refreshKey = 0,
}: {
  tenantId: string;
  journalId: string;
  refreshKey?: number;
}) {
  const [stats, setStats] = useState<{
    totalFiches: number;
    totalFichesManquantes: number;
  } | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiClient.get(
        `/pedagogy-space/cahier-journal/${journalId}/fiches?_r=${refreshKey}`,
      );
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
  }, [journalId, refreshKey]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);
  // ⭐ 2026-09-18 : refreshKey change après chaque enregistrement du cahier
  //    journal → loadStats est recréé → ce useEffect re-fetch le badge.

  // ⭐ Écouter l'event 'fiche:saved' pour mettre à jour le badge automatiquement
  useEffect(() => {
    const handleFicheSaved = () => {
      setTimeout(() => loadStats(), 300);
    };
    window.addEventListener('fiche:saved', handleFicheSaved);
    return () => window.removeEventListener('fiche:saved', handleFicheSaved);
  }, [loadStats]);

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

// ─── Helper : mapper une matière (clé du cahier journal) vers un sheetType ──

/**
 * Mappe le nom d'une matière (clé dans les entries du cahier journal)
 * vers le sheetType correspondant pour la fiche pédagogique.
 *
 * Le cahier journal utilise les noms de matières comme clés (ex: "Français", "Mathématiques"),
 * tandis que les fiches pédagogiques utilisent des codes (FRANCAIS, MATH, etc.).
 * Cette fonction fait la correspondance pour que quand on clique "Préparer la fiche"
 * pour une matière, le bon type de fiche soit pré-sélectionné.
 */
/**
 * ⭐ MATERNELLE — MATIÈRES DYNAMIQUES : mappe une matière du cahier journal
 * vers le type de fiche pédagogique maternelle. Les matières sont désormais
 * les NOMS des matières configurées dans « Matières & programmes » (clés du
 * cahier journal) + les anciennes clés legacy (dom1_sante…).
 * Unifie la logique backend mapMatiereKeyToSheetType(key, isMaternelle=true).
 */
function mapMatiereToSheetType(matiere: string, isMaternelle = false): string {
  if (isMaternelle) return mapMatiereNameToSheetType(matiere);
  const m = (matiere || '').toLowerCase().trim();
  // ⭐ Clés legacy maternelle (journaux créés avant les matières dynamiques)
  if (m === 'dom2_corporelle') return 'DOMAINE_2';
  if (m.startsWith('dom') || m === 'pre_lecture' || m === 'pre_ecriture' || m === 'pre_mathematiques') return 'DOMAINE';
  // ⭐ 2026-09-15 — FICHE STANDARD pour l'anglais et l'informatique enseignés
  //    comme matières par un enseignant spécialisé (écoles non bilingues).
  //    Ces vérifications AVANT les autres branches : « informatique » ne doit
  //    plus tomber dans EST, et « anglais » doit trouver son modèle standard.
  if (m.includes('anglais') || m.includes('english') || m.includes('informatique') || m.includes('computer')) return 'STANDARD';
  // Français
  if (m === 'français' || m === 'francais' || m === 'fran\u00e7ais') return 'FRANCAIS';
  // Mathématiques
  if (m === 'mathématiques' || m === 'mathematiques' || m === 'maths' || m === 'math' || m === 'pré-mathématique' || m === 'pre-mathematique') return 'MATH';
  // Éducation Scientifique et Technologique
  if (m.includes('scientifique') || m.includes('est') || m === 'science' || m === 'sciences') return 'EST';
  // Éducation Physique et Sportive
  if (m.includes('eps') || m.includes('sport') || m.includes('éducation physique') || m.includes('education physique') || m.includes('athlétisme') || m.includes('athletisme') || m.includes('gymnastique') || m.includes('jeu collectif')) return 'EPS';
  // Éducation Sociale
  if (m.includes('social') || m.includes('morale') || m.includes('civisme') || m.includes('histoire') || m.includes('géographie') || m.includes('geographie')) return 'ES';
  // Éducation Artistique
  if (m.includes('artistique') || m.includes('chant') || m.includes('dessin') || m.includes('poésie') || m.includes('poesie') || m.includes('musique')) return 'EA';
  // Direct observation (qui ne devrait pas apparaître — c'est un type non standard)
  if (m.includes('direct') || m.includes('observation')) return '';
  // Default: pas de correspondance → laisse l'utilisateur choisir
  return '';
}

// ⭐ Libellés lisibles des anciennes colonnes de la grille maternelle (clés
//    legacy — les nouvelles clés sont directement les noms des matières
//    configurées, affichés tels quels).
const MATIERE_LABELS: Record<string, string> = { ...MAT_MATIERE_LABELS };

// ─── Liste des matières planifiées + boutons "Préparer la fiche" ────────────

function FichesAPreparer({
  tenantId,
  journalId,
  refreshKey = 0,
  onPrepareFiche,
  onViewFiche,
  onCreateFreeFiche,
}: {
  tenantId: string;
  journalId: string;
  /** ⭐ Incrémenté à chaque enregistrement du cahier journal → re-fetch */
  refreshKey?: number;
  onPrepareFiche: (day: string, matiere: string, sheetType?: string, sousMatiere?: string) => void;
  /** ⭐ Callback pour le bouton "Voir la fiche" (ouvre la fiche existante en édition) */
  onViewFiche?: (ficheId: string) => void;
  /** ⭐ Callback pour le bouton "Créer une fiche libre" (sans pré-remplissage) */
  onCreateFreeFiche?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ⭐ cache-bust : le journal vient d'être enregistré (même journalId) —
      //    on force la relecture côté BFF/navigateur.
      const res = await apiClient.get(
        `/pedagogy-space/cahier-journal/${journalId}/fiches?_r=${refreshKey}`,
      );
      setData(res.data);
    } catch (e: any) {
      toast.error("Erreur chargement fiches", {
        description: e.message || "Impossible de charger les fiches du cahier journal.",
      });
    } finally {
      setLoading(false);
    }
  }, [journalId, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  // ⭐ Écouter l'event 'fiche:saved' émis par PedagogicalSheetsTab après création/update
  //    d'une fiche. Sans ça, le compteur "X/Y fiches préparées" ne se met pas à jour
  //    tant que l'utilisateur ne recharge pas la page manuellement.
  useEffect(() => {
    const handleFicheSaved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Recharger si la fiche concerne ce cahier journal
      if (detail?.cahierJournalId === journalId || !detail?.cahierJournalId) {
        // Petit délai (300ms) pour laisser le backend terminer l'enregistrement
        setTimeout(() => load(), 300);
      }
    };
    window.addEventListener('fiche:saved', handleFicheSaved);
    return () => window.removeEventListener('fiche:saved', handleFicheSaved);
  }, [load, journalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement des fiches du cahier journal…
      </div>
    );
  }

  if (!data) return null;

  // ⭐ MATERNELLE : l'API /fiches indique si le cahier journal est maternelle
  //    (grille par domaines, fiches DOMAINE/DOMAINE_2, matières = matières
  //    configurées dans « Matières & programmes »).
  const isMaternelle = !!data.isMaternelle;

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
  // ⭐ FEATURE « Sous-matières & fiches à préparer » : décomptes au niveau
  //    FICHE (une exigence par sous-matière renseignée dans le cahier journal)
  //    + distinction marquage explicite vs matières sans fiche (historique).
  const totalFichesAPreparer = stats.totalFichesAPreparer || stats.totalMatieresPlanifiees || 0;
  const parJourManquantes: Record<string, number> = stats.fichesManquantesParJour || {};
  const parJourTotal: Record<string, number> = stats.fichesTotalParJour || {};
  const joursAvecFiches = days.filter(
    (d) =>
      (parJourManquantes[d] || 0) > 0 ||
      (parJourTotal[d] || 0) > 0 ||
      (data.matieresPlanifiees?.[d] || []).length > 0,
  );
  const isModeMarquage = !!data.hasExplicitFichesAPreparer;

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
              : `${stats.totalFichesManquantes || 0} fiche(s) pédagogique(s) à préparer ${
                  isModeMarquage ? "— sous-matières renseignées dans le cahier journal" : "cette semaine"
                }`}
          </p>
          <p className="text-xs opacity-80">
            {stats.totalFichesPreparees || 0} / {totalFichesAPreparer} fiches préparées ·{" "}
            {stats.totalMatieresPlanifiees || 0} matière(s) concernée(s) · {stats.totalFiches || 0} fiche(s) créée(s)
          </p>
          {/* ⭐ Décompte par jour (demande promoteur : « pour chaque jour le nombre
              de fiches chaque jour et le nombre total pour la semaine ») — au
              niveau FICHE (sous-matières), pas matière. */}
          {joursAvecFiches.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {joursAvecFiches.map((d) => {
                const manquantes = parJourManquantes[d] || 0;
                const total = parJourTotal[d] || (data.matieresPlanifiees?.[d] || []).length;
                return (
                  <span
                    key={d}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                      manquantes > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700",
                    )}
                    title={`${manquantes} fiche(s) à préparer le ${dayLabels[d]}`}
                  >
                    {dayLabels[d]}
                    <span className="font-black">{manquantes}</span>
                    <span className="opacity-60">/{total}</span>
                  </span>
                );
              })}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                Total semaine : {stats.totalFichesManquantes || 0}
              </span>
            </div>
          )}
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

      {/* Liste par jour : jour → matière → sous-matières (une ligne = une fiche) */}
      <div className="space-y-3">
        {days.map((day) => {
          const matieres = (data.matieresPlanifiees?.[day] || []) as Array<{
            matiere: string;
            fichePreparede: boolean;
            ficheId?: string;
            sousMatieres?: Array<{ nom: string; fichePreparede: boolean; ficheId?: string }>;
          }>;
          if (matieres.length === 0) return null;
          const dayTotalFiches = matieres.reduce((s, m) => s + (m.sousMatieres?.length || 1), 0);
          const dayPrepared = matieres.reduce(
            (s, m) => s + (m.sousMatieres || [{ nom: "", fichePreparede: m.fichePreparede, ficheId: m.ficheId }])
              .filter((sm) => sm.fichePreparede).length, 0);
          const dayComplete = dayPrepared >= dayTotalFiches;
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
                  {dayPrepared} / {dayTotalFiches} fiche{dayTotalFiches > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {matieres.map((m) => {
                  // ⭐ Sous-matières renseignées (mode marquage v2) — fallback
                  //    matière entière (historique : sousMatieres = [] ou absent)
                  const sousMatieres =
                    m.sousMatieres && m.sousMatieres.length > 0
                      ? m.sousMatieres
                      : [{ nom: "", fichePreparede: m.fichePreparede, ficheId: m.ficheId }];
                  const matiereSheetType = mapMatiereToSheetType(m.matiere, isMaternelle);
                  // ⭐ 4e passe promoteur : nom de matière LISIBLE — EST / EPS en
                  //    abrégé (les clés de données restent les noms complets).
                  const matiereAffichee =
                    MATIERE_LABELS[m.matiere] || affichageMatiere(m.matiere.replace(/_/g, " "));
                  return (
                    <div
                      key={`${day}-${m.matiere}`}
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs bg-white",
                        m.fichePreparede ? "border-emerald-200" : "border-amber-200",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                        {m.fichePreparede ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="font-bold text-slate-700 truncate capitalize">
                          {matiereAffichee}
                        </span>
                        <span className="ml-auto text-[10px] font-bold text-slate-400 shrink-0">
                          {sousMatieres.filter((sm) => sm.fichePreparede).length}/{sousMatieres.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {sousMatieres.map((sm, smIdx) => (
                          <div
                            key={`${day}-${m.matiere}-${smIdx}`}
                            className="flex items-center justify-between gap-2 rounded px-1.5 py-1 bg-slate-50/70"
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {sm.fichePreparede ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                              )}
                              <span className="font-medium text-slate-600 truncate">
                                {/* ⭐ 4e passe promoteur : la fiche sans sous-matière
                                    porte le NOM RÉEL de la matière (« Mathématiques »,
                                    « EST », « EPS »…) au lieu du générique
                                    « Fiche de la matière ». */}
                                {sm.nom ? sm.nom : matiereAffichee}
                              </span>
                            </div>
                            {sm.fichePreparede ? (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  // ⭐ Ouvrir la fiche existante en édition
                                  if (sm.ficheId && onViewFiche) {
                                    onViewFiche(sm.ficheId);
                                  } else if (m.ficheId && onViewFiche) {
                                    onViewFiche(m.ficheId);
                                  } else {
                                    onPrepareFiche(day, m.matiere, matiereSheetType, sm.nom || undefined);
                                  }
                                }}
                                className="text-[10px] font-bold text-blue-600 hover:underline ml-1 shrink-0"
                              >
                                Voir
                              </a>
                            ) : (
                              <button
                                onClick={() => onPrepareFiche(day, m.matiere, matiereSheetType, sm.nom || undefined)}
                                className="flex items-center gap-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded ml-1 shrink-0"
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
        })}
      </div>
    </div>
  );
}

// ─── Fiches pédagogiques liées au cahier journal (affichées dans l'onglet Cahier) ──

/**
 * Affiche la liste des fiches pédagogiques déjà créées pour le cahier journal
 * courant. Chaque fiche a un bouton "Voir / Éditer" qui bascule vers le
 * sous-onglet Fiches en mode édition.
 *
 * Ce composant est affiché en dessous de la grille hebdo dans le sous-onglet
 * "Cahier Journal" pour que l'enseignant voie directement quelles fiches sont
 * déjà préparées pour la semaine courante — même quand il switch de semaine.
 */
function FichesLieesJournal({
  journalId,
  refreshKey = 0,
  onViewFiche,
  weekStartDate,
  weekEndDate,
}: {
  journalId: string;
  /** ⭐ Incrémenté à chaque enregistrement du cahier journal → re-fetch */
  refreshKey?: number;
  onViewFiche: (ficheId: string) => void;
  weekStartDate?: string;
  weekEndDate?: string;
}) {
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/pedagogy-space/cahier-journal/${journalId}/fiches?_r=${refreshKey}`,
      );
      // Les fiches liées sont dans res.data.fichesLiees ou res.data.fiches
      const data = res.data;
      const fichesLiees = data?.fichesLiees || data?.fiches || [];
      setFiches(Array.isArray(fichesLiees) ? fichesLiees : []);
    } catch {
      setFiches([]);
    } finally {
      setLoading(false);
    }
  }, [journalId, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  // ⭐ Écouter l'event 'fiche:saved' pour recharger quand une fiche est créée/mise à jour
  useEffect(() => {
    const handleFicheSaved = () => {
      setTimeout(() => load(), 300);
    };
    window.addEventListener('fiche:saved', handleFicheSaved);
    return () => window.removeEventListener('fiche:saved', handleFicheSaved);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des fiches liées…
        </div>
      </div>
    );
  }

  if (fiches.length === 0) {
    return null; // Ne pas afficher la section s'il n'y a pas de fiches liées
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-emerald-600" />
        <h4 className="text-sm font-bold text-slate-800">
          Fiches pédagogiques préparées pour cette semaine
        </h4>
        <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
          {fiches.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {fiches.map((fiche: any) => (
          <div
            key={fiche.id}
            className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-slate-700 truncate" title={fiche.matiereSpecifique ? String(fiche.matiereSpecifique).replace(/<[^>]*>/g, '') : undefined}>
                  {/* ⭐ Affiche la sous-matière (matiereSpecifique) quand elle est
                      renseignée — ex : « FRANCAIS — Vocabulaire thématique » */}
                  {(() => {
                    const base = fiche.sheetType === 'DOMAINE_2' ? 'Domaine 2' : fiche.sheetType === 'DOMAINE' ? 'Domaine' : fiche.sheetType || fiche.competence || 'Fiche';
                    const sm = fiche.matiereSpecifique ? String(fiche.matiereSpecifique).replace(/<[^>]*>/g, '').trim() : '';
                    return sm ? `${base} — ${sm}` : base;
                  })()}
                </div>
                {fiche.lessonDate && (
                  <div className="text-[10px] text-slate-400">
                    {new Date(fiche.lessonDate).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <button
                onClick={() => onViewFiche(fiche.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded"
              >
                <Eye className="h-3 w-3" />
                Voir
              </button>
              {/* ⭐ Bouton PDF — génère un PDF professionnel depuis le backend */}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/pedagogy-space/fiches/${fiche.id}/export-pdf`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    // ⭐ Nom du fichier : Fiche pédagogique [matière] [jour] [date] période [date] à [date]
                    const SHEET_LABELS: Record<string, string> = {
                      MATH: 'Mathematiques', FRANCAIS: 'Francais', EST: 'EST', ES: 'Education Sociale', EA: 'Education Artistique', EPS: 'EPS',
                      DOMAINE: 'Domaine', DOMAINE_2: 'Domaine 2', STANDARD: 'Anglais-Informatique',
                    };
                    const matiere = SHEET_LABELS[fiche.sheetType] || fiche.sheetType || 'Fiche';
                    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                    const lessonDate = fiche.lessonDate ? new Date(fiche.lessonDate) : null;
                    const jour = lessonDate ? days[lessonDate.getDay()] : '';
                    const dateStr = lessonDate ? `${lessonDate.getDate()}-${lessonDate.getMonth() + 1}-${lessonDate.getFullYear()}` : '';
                    // Période : semaine du cahier journal (weekStartDate à weekEndDate)
                    let periode = '';
                    if (weekStartDate && weekEndDate) {
                      const ws = new Date(weekStartDate);
                      const we = new Date(weekEndDate);
                      const wsStr = `${ws.getDate()}-${ws.getMonth() + 1}-${ws.getFullYear()}`;
                      const weStr = `${we.getDate()}-${we.getMonth() + 1}-${we.getFullYear()}`;
                      periode = ` periode ${wsStr} a ${weStr}`;
                    }
                    const fileName = `Fiche pedagogique ${matiere}${jour ? ' ' + jour : ''}${dateStr ? ' ' + dateStr : ''}${periode}.pdf`;
                    a.download = fileName;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (e: any) {
                    toast.error('Erreur export PDF', { description: e.message });
                  }
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                title="Télécharger la fiche en PDF"
              >
                <Download className="h-3 w-3" />
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
