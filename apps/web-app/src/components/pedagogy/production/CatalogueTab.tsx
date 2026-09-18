"use client";

/**
 * ============================================================================
 * CATALOGUE — Cahiers journaux & Fiches pédagogiques des années antérieures
 * ============================================================================
 *
 * Vue hiérarchique type "Explorateur Windows" permettant à l'enseignant de
 * naviguer dans l'historique de ses cahiers journaux + fiches pédagogiques
 * sur TOUTES les années scolaires du tenant.
 *
 * Hiérarchie :
 *   Année (ex: 2025-2026)
 *     └── Trimestre (ex: Premier trimestre 01/09 → 31/12)
 *          └── Mois (ex: Septembre)
 *               └── Semaine (ex: 15/09 → 19/09)
 *                    ├── Cahier journal (carte avec boutons Voir / PDF / Réutiliser)
 *                    └── Fiches pédagogiques jointes (cartes avec boutons Voir / PDF / Réutiliser)
 *
 * Boutons :
 *   - Voir (cahier journal) → affichage inline de la grille hebdo (read-only)
 *   - Voir (fiche) → bascule vers le sous-onglet "Fiches Pédagogiques" avec
 *     la fiche chargée en édition via `onViewFiche(ficheId)`
 *   - PDF → téléchargement direct du PDF (cahier journal ou fiche)
 *   - Réutiliser → duplication vers l'année courante avec dates recalculées
 *
 * Backend endpoints utilisés :
 *   - GET  /api/pedagogy-space/catalogue?teacherId=&classId=
 *   - POST /api/pedagogy-space/cahier-journal/:id/duplicate-to-year
 *   - POST /api/pedagogy-space/fiches/:id/duplicate-to-year
 *   - GET  /api/pedagogy-space/cahier-journal/:id/export?format=pdf
 *   - GET  /api/pedagogy-space/fiches/:id/export-pdf
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Loader2,
  Calendar,
  FileText,
  FileSpreadsheet,
  Eye,
  Download,
  Copy,
  ArrowLeft,
  BookOpen,
  Sigma,
  FlaskConical,
  Users,
  Palette,
  Dumbbell,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  CalendarDays,
  CalendarRange,
  Search,
  School,
} from "lucide-react";

interface CatalogueTabProps {
  tenantId: string;
  /** ID de l'année scolaire courante (cible de la duplication) */
  academicYearId: string;
  teacherId: string;
  /** Callback pour ouvrir une fiche dans le sous-onglet "Fiches Pédagogiques" */
  onViewFiche?: (ficheId: string) => void;
}

// ⭐ Type du chemin de navigation dans l'arbre hiérarchique
//    Niveaux : class → year → trimester → month
type NavLevel = "class" | "year" | "trimester" | "month";
type NavStep = { type: NavLevel; id: string; label: string };

// ⭐ Libellés + icônes + couleurs pour les types de fiche
const SHEET_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  MATH: { label: "Mathématiques", icon: Sigma, color: "bg-blue-100 text-blue-700" },
  FRANCAIS: { label: "Français", icon: BookOpen, color: "bg-emerald-100 text-emerald-700" },
  EST: { label: "EST", icon: FlaskConical, color: "bg-purple-100 text-purple-700" },
  ES: { label: "Éducation Sociale", icon: Users, color: "bg-amber-100 text-amber-700" },
  EA: { label: "Éducation Artistique", icon: Palette, color: "bg-pink-100 text-pink-700" },
  EPS: { label: "EPS", icon: Dumbbell, color: "bg-cyan-100 text-cyan-700" },
};

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
};

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ============================================================================
// COMPOSANT PRINCIPAL — CatalogueTab
// ============================================================================

export function CatalogueTab({ tenantId, academicYearId, teacherId, onViewFiche }: CatalogueTabProps) {
  const [data, setData] = useState<{ classes: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  // ⭐ Chemin de navigation dans l'arbre ( breadcrumbs)
  //    Ex: [{type:'class', id:'abc', label:'CP1'}, {type:'year', id:'2025', label:'2025-2026'},
  //         {type:'trimester', id:'1', label:'Premier trimestre'}, {type:'month', id:'9', label:'Septembre'}]
  const [path, setPath] = useState<NavStep[]>([]);
  // ⭐ Cahier journal en cours de visualisation inline (null = vue arbre)
  const [viewedJournal, setViewedJournal] = useState<any>(null);
  // ⭐ IDs en cours de duplication (pour désactiver les boutons)
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  // ⭐ ID en cours d'export PDF
  const [exportingId, setExportingId] = useState<string | null>(null);
  // ⭐ Recherche par nom de classe (filtre les dossiers racine)
  const [searchQuery, setSearchQuery] = useState("");
  // ⭐ Niveaux scolaires dépliés/repliés (collapsed school levels)
  //    Initialisé à "all open" — l'utilisateur replie manuellement si trop de classes
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());

  // === CHARGEMENT DU CATALOGUE ===
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId });
      const res = await fetch(`/api/pedagogy-space/catalogue?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast.error("Erreur chargement catalogue", {
        description: e.message || "Impossible de charger le catalogue.",
      });
      setData({ academicYears: [] });
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  // === NAVIGATION ===
  const navigateTo = (folder: NavStep) => {
    // Tronquer le path jusqu'au niveau parent du folder
    const typeOrder: Record<NavLevel, number> = { class: 0, year: 1, trimester: 2, month: 3 };
    const newLevel = typeOrder[folder.type];
    const truncated = path.filter(p => typeOrder[p.type] < newLevel);
    setPath([...truncated, folder]);
    setViewedJournal(null);
  };

  const navigateUp = (level: NavLevel | "root") => {
    if (level === "root") {
      setPath([]);
      setViewedJournal(null);
      return;
    }
    const typeOrder: Record<NavLevel, number> = { class: 0, year: 1, trimester: 2, month: 3 };
    const targetLevel = typeOrder[level];
    setPath(path.filter(p => typeOrder[p.type] <= targetLevel));
    setViewedJournal(null);
  };

  // === ACTIONS (Voir / PDF / Réutiliser) ===

  // Voir un cahier journal (affichage inline)
  const handleViewJournal = (journal: any) => {
    setViewedJournal(journal);
  };

  // Voir une fiche pédagogique → bascule vers le sous-onglet Fiches
  const handleViewFiche = (ficheId: string) => {
    if (onViewFiche) {
      onViewFiche(ficheId);
    } else {
      toast.error("Impossible d'ouvrir la fiche");
    }
  };

  // Export PDF d'un cahier journal
  const handleExportJournalPDF = async (journalId: string, className?: string) => {
    setExportingId(journalId);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journalId}/export?format=pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cahier_journal_${(className || "classe").replace(/\s+/g, "_").toLowerCase()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Erreur export PDF", { description: e.message });
    } finally {
      setExportingId(null);
    }
  };

  // Export PDF d'une fiche
  const handleExportFichePDF = async (ficheId: string, sheetType: string) => {
    setExportingId(ficheId);
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${ficheId}/export-pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = SHEET_LABELS[sheetType]?.label || "Fiche";
      a.download = `fiche_${label.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Erreur export PDF", { description: e.message });
    } finally {
      setExportingId(null);
    }
  };

  // Réutiliser un cahier journal → duplique vers l'année courante
  const handleReuseJournal = async (journalId: string) => {
    if (!confirm("Réutiliser ce cahier journal pour l'année courante ?\n\nUne copie sera créée avec les dates ajustées à l'année courante. Vous pourrez ensuite l'éditer et le soumettre au directeur.")) {
      return;
    }
    setDuplicatingIds(prev => new Set([...prev, journalId]));
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journalId}/duplicate-to-year`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetAcademicYearId: academicYearId,
          targetTeacherId: teacherId,
          // targetClassId non fourni → utilise la classe d'origine
          // targetWeekStartDate non fourni → recalcul auto (même semaine année courante)
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const newJournal = await res.json();
      toast.success("✅ Cahier journal réutilisé", {
        description: `Une copie a été créée pour la semaine du ${newJournal.weekStartDate ? formatDateFR(newJournal.weekStartDate) : "—"}. Statut : Brouillon. Vous pouvez l'éditer dans l'onglet Cahier Journal.`,
      });
    } catch (e: any) {
      toast.error("Erreur lors de la réutilisation", { description: e.message });
    } finally {
      setDuplicatingIds(prev => {
        const next = new Set(prev);
        next.delete(journalId);
        return next;
      });
    }
  };

  // Réutiliser une fiche pédagogique → duplique vers l'année courante
  const handleReuseFiche = async (ficheId: string, sheetType: string) => {
    if (!confirm(`Réutiliser cette fiche (${SHEET_LABELS[sheetType]?.label || sheetType}) pour l'année courante ?\n\nUne copie sera créée en statut Brouillon. Vous pourrez l'éditer et la soumettre au directeur.`)) {
      return;
    }
    setDuplicatingIds(prev => new Set([...prev, ficheId]));
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${ficheId}/duplicate-to-year`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetAcademicYearId: academicYearId,
          targetTeacherId: teacherId,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success("✅ Fiche réutilisée", {
        description: "Une copie a été créée en statut Brouillon pour l'année courante. Vous pouvez l'éditer dans l'onglet Fiches Pédagogiques.",
      });
    } catch (e: any) {
      toast.error("Erreur lors de la réutilisation", { description: e.message });
    } finally {
      setDuplicatingIds(prev => {
        const next = new Set(prev);
        next.delete(ficheId);
        return next;
      });
    }
  };

  // === RENDU ===

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="font-medium">Chargement du catalogue…</p>
        <p className="text-xs text-slate-400 mt-1">Récupération des cahiers journaux et fiches pédagogiques de toutes les années</p>
      </div>
    );
  }

  if (!data || !data.classes || data.classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <FolderOpen className="h-12 w-12 text-slate-300 mb-3" />
        <p className="font-medium">Catalogue vide</p>
        <p className="text-sm text-slate-400 mt-1">
          Aucune classe ni cahier journal ou fiche pédagogique trouvé pour votre compte.
          Commencez par enregistrer un cahier journal ou créer une fiche.
        </p>
      </div>
    );
  }

  // ⭐ Si un cahier journal est en cours de visualisation inline, l'afficher
  if (viewedJournal) {
    return (
      <CahierJournalViewer
        journal={viewedJournal}
        onBack={() => setViewedJournal(null)}
        onExportPDF={() => handleExportJournalPDF(viewedJournal.cahierJournal?.id || viewedJournal.id, viewedJournal.cahierJournal?.className || viewedJournal.className)}
        exporting={exportingId === (viewedJournal.cahierJournal?.id || viewedJournal.id)}
      />
    );
  }

  // ⭐ Trouver le niveau courant dans l'arbre
  const currentClass = path.find(p => p.type === "class");
  const currentYear = path.find(p => p.type === "year");
  const currentTrimester = path.find(p => p.type === "trimester");
  const currentMonth = path.find(p => p.type === "month");

  // ⭐ Donnée de la classe courante (racine du sous-arbre années)
  const classData = currentClass ? data.classes.find(c => c.id === currentClass.id) : null;
  // ⭐ Pour rétrocompatibilité : si pas de currentClass mais que data.classes a 1 seule classe,
  //    on la prend automatiquement (cas ancien appel sans niveau class)
  const effectiveClass = currentClass
    ? classData
    : (data.classes.length === 1 ? data.classes[0] : null);

  const yearData = currentYear && effectiveClass
    ? effectiveClass.academicYears.find((y: any) => y.id === currentYear.id)
    : null;
  const trimesterData = currentYear && yearData && currentTrimester
    ? yearData.trimesters.find((t: any) => String(t.trimester) === currentTrimester.id)
    : null;
  const monthData = trimesterData && currentMonth
    ? trimesterData.months.find((m: any) => String(m.month) === currentMonth.id)
    : null;

  return (
    <div className="space-y-4">
      {/* === BREADCRUMB / FIL D'ARIANE === */}
      <div className="flex items-center gap-1 text-xs flex-wrap bg-slate-50 border border-slate-200 rounded-lg p-2.5">
        <button
          onClick={() => navigateUp("root")}
          className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded"
        >
          <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
          Catalogue
        </button>
        {/* ⭐ Niveau CLASSE (nouveau) */}
        {(effectiveClass || currentClass) && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              onClick={() => navigateUp("class")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded"
            >
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              {(effectiveClass || currentClass)?.label || (effectiveClass || currentClass)?.name}
            </button>
          </>
        )}
        {currentYear && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              onClick={() => navigateUp("year")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded"
            >
              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
              {currentYear.label}
            </button>
          </>
        )}
        {currentTrimester && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              onClick={() => navigateUp("trimester")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded"
            >
              <CalendarRange className="h-3.5 w-3.5 text-purple-600" />
              {currentTrimester.label}
            </button>
          </>
        )}
        {currentMonth && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              onClick={() => navigateUp("month")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded"
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              {currentMonth.label}
            </button>
          </>
        )}
      </div>

      {/* === NIVEAU RACINE : liste des CLASSES, regroupées par niveau scolaire === */}
      {/*    Affiché quand aucune classe n'est sélectionnée ET qu'il y a plusieurs classes. */}
      {/*    S'il n'y a qu'une seule classe, on saute directement au niveau année. */}
      {!currentClass && data.classes.length > 1 && (
        <div className="space-y-4">
          {/* ⭐ Barre de recherche par nom de classe */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-2 sticky top-0 z-10">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une classe par nom (ex: CP1, CE2, 6ème...)"
              className="flex-1 px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded"
              >
                ✕ Effacer
              </button>
            )}
            <span className="text-[10px] text-slate-400 hidden sm:inline whitespace-nowrap">
              {data.classes.filter(c => !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase())).length} classe(s)
            </span>
          </div>

          {/* ⭐ Groupement par niveau scolaire (Maternelle, Primaire, Secondaire, ...) */}
          {/*    Chaque niveau est un dossier collapsible contenant ses classes */}
          {(() => {
            // Filtrer les classes par recherche
            const filteredClasses = data.classes.filter(c =>
              !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filteredClasses.length === 0) {
              return (
                <div className="text-center py-12 text-slate-400">
                  <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium">Aucune classe trouvée</p>
                  <p className="text-xs mt-1">Essayez un autre terme de recherche.</p>
                </div>
              );
            }

            // Grouper par schoolLevelName (fallback "Autres" si null)
            const groups: Record<string, any[]> = {};
            for (const cls of filteredClasses) {
              const level = cls.schoolLevelName || "Autres";
              if (!groups[level]) groups[level] = [];
              groups[level].push(cls);
            }

            // Ordonner les niveaux : Maternelle < Primaire < Secondaire < Collège < Lycée < Autres
            const levelOrder = ["Maternelle", "Primaire", "Secondaire", "Collège", "Lycée", "Autres"];
            const sortedLevels = Object.keys(groups).sort((a, b) => {
              const ia = levelOrder.indexOf(a);
              const ib = levelOrder.indexOf(b);
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });

            // Couleurs distinctes par niveau scolaire pour différenciation visuelle
            const levelColors: Record<string, string> = {
              Maternelle: "text-pink-600 bg-pink-50 border-pink-200",
              Primaire: "text-blue-600 bg-blue-50 border-blue-200",
              Secondaire: "text-purple-600 bg-purple-50 border-purple-200",
              Collège: "text-amber-600 bg-amber-50 border-amber-200",
              Lycée: "text-emerald-600 bg-emerald-50 border-emerald-200",
              Autres: "text-slate-600 bg-slate-50 border-slate-200",
            };

            return sortedLevels.map((level) => {
              const classesInGroup = groups[level];
              const isCollapsed = collapsedSchoolLevels.has(level);
              const colorClasses = levelColors[level] || levelColors.Autres;
              return (
                <div key={level} className={cn("border rounded-lg overflow-hidden", colorClasses.split(' ').slice(-1)[0])}>
                  {/* En-tête du niveau scolaire (cliquable pour replier/déplier) */}
                  <button
                    onClick={() => {
                      setCollapsedSchoolLevels(prev => {
                        const next = new Set(prev);
                        if (next.has(level)) next.delete(level);
                        else next.add(level);
                        return next;
                      });
                    }}
                    className={cn("w-full flex items-center gap-2 px-4 py-3 font-bold text-sm transition-colors", colorClasses)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <School className="h-5 w-5" />
                    <span>{level}</span>
                    <span className="ml-1 text-xs font-normal opacity-75">
                      ({classesInGroup.length} classe{classesInGroup.length > 1 ? "s" : ""})
                    </span>
                  </button>
                  {/* Liste des classes du niveau (si déplié) */}
                  {!isCollapsed && (
                    <div className="bg-white border-t border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {classesInGroup.map((cls: any) => {
                        const totalWeeks = cls.academicYears?.reduce(
                          (s: number, y: any) => s + y.trimesters.reduce(
                            (ts: number, t: any) => ts + t.months.reduce((ms: number, m: any) => ms + m.weeks.length, 0), 0
                          ), 0
                        ) || 0;
                        const totalFiches = cls.academicYears?.reduce(
                          (s: number, y: any) => s + y.trimesters.reduce(
                            (ts: number, t: any) => ts + t.months.reduce(
                              (ms: number, m: any) => ms + m.weeks.reduce((ws: number, w: any) => ws + (w.fiches?.length || 0), 0), 0
                            ), 0
                          ), 0
                        ) || 0;
                        const hasActiveYear = cls.academicYears?.some((y: any) => y.isActive);
                        return (
                          <button
                            key={cls.id}
                            onClick={() => navigateTo({ type: "class", id: cls.id, label: cls.name })}
                            className="group flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left"
                          >
                            <Folder className={cn("h-10 w-10", hasActiveYear ? "text-emerald-500" : "text-indigo-500")} />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-900 text-sm truncate">{cls.name}</h3>
                              {cls.schoolLevelName && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{cls.schoolLevelName}</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {cls.academicYears?.length || 0} année(s) · {totalWeeks} semaine(s) · {totalFiches} fiche(s)
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* === NIVEAU CLASSE → liste des années === */}
      {/*    Affiché quand une classe est sélectionnée (ou qu'il n'y a qu'une seule classe). */}
      {effectiveClass && !currentYear && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {effectiveClass.academicYears.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400">
              <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium">Aucun cahier journal ni fiche pour cette classe</p>
            </div>
          ) : (
            effectiveClass.academicYears.map((year: any) => {
              const trimesterCount = year.trimesters?.length || 0;
              const weekCount = year.trimesters?.reduce(
                (s: number, t: any) => s + t.months.reduce((ms: number, m: any) => ms + m.weeks.length, 0), 0
              ) || 0;
              const isActive = year.isActive;
              return (
                <button
                  key={year.id}
                  onClick={() => navigateTo({ type: "year", id: year.id, label: `Année ${year.name}` })}
                  className="group flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left"
                >
                  <Folder className={cn("h-10 w-10", isActive ? "text-emerald-500" : "text-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-sm">{year.name}</h3>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Courante</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formatDateFR(year.startDate)} → {formatDateFR(year.endDate)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {trimesterCount} trimestre(s) · {weekCount} semaine(s)
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* === NIVEAU ANNÉE : liste des trimestres === */}
      {currentYear && yearData && !currentTrimester && (
        <div className="space-y-3">
          {yearData.trimesters.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium">Aucun cahier journal ni fiche pour cette année</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {yearData.trimesters.map((t: any) => {
                const weekCount = t.months.reduce((ms: number, m: any) => ms + m.weeks.length, 0);
                return (
                  <button
                    key={t.trimester}
                    onClick={() => navigateTo({ type: "trimester", id: String(t.trimester), label: t.label })}
                    className="group flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left"
                  >
                    <Folder className="h-10 w-10 text-purple-500" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm">{t.label}</h3>
                      {t.dateRange.start && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatDateFR(t.dateRange.start)} → {formatDateFR(t.dateRange.end || t.dateRange.start)}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {t.months.length} mois · {weekCount} semaine(s)
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === NIVEAU TRIMESTRE : liste des mois === */}
      {currentYear && yearData && currentTrimester && trimesterData && !currentMonth && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trimesterData.months.map((m: any) => {
              const weekCount = m.weeks.length;
              return (
                <button
                  key={m.month}
                  onClick={() => navigateTo({ type: "month", id: String(m.month), label: m.label })}
                  className="group flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-left"
                >
                  <Folder className="h-10 w-10 text-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm">{m.label}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{weekCount} semaine(s)</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === NIVEAU MOIS : liste des semaines + cahiers journaux + fiches === */}
      {currentYear && yearData && currentTrimester && trimesterData && currentMonth && monthData && (
        <div className="space-y-3">
          {monthData.weeks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium">Aucune semaine pour ce mois</p>
            </div>
          ) : (
            monthData.weeks.map((week: any, idx: number) => (
              <WeekCard
                key={`${week.weekStartDate}-${idx}`}
                week={week}
                onViewJournal={handleViewJournal}
                onViewFiche={handleViewFiche}
                onExportJournalPDF={handleExportJournalPDF}
                onExportFichePDF={handleExportFichePDF}
                onReuseJournal={handleReuseJournal}
                onReuseFiche={handleReuseFiche}
                duplicatingIds={duplicatingIds}
                exportingId={exportingId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANT : WeekCard — Une semaine avec son cahier journal + ses fiches
// ============================================================================

function WeekCard({
  week,
  onViewJournal,
  onViewFiche,
  onExportJournalPDF,
  onExportFichePDF,
  onReuseJournal,
  onReuseFiche,
  duplicatingIds,
  exportingId,
}: {
  week: any;
  onViewJournal: (journal: any) => void;
  onViewFiche: (ficheId: string) => void;
  onExportJournalPDF: (journalId: string, className?: string) => void;
  onExportFichePDF: (ficheId: string, sheetType: string) => void;
  onReuseJournal: (journalId: string) => void;
  onReuseFiche: (ficheId: string, sheetType: string) => void;
  duplicatingIds: Set<string>;
  exportingId: string | null;
}) {
  const journal = week.cahierJournal;
  const fiches = week.fiches || [];
  const journalStatus = journal?.status ? STATUS_BADGES[journal.status] : null;

  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
      {/* En-tête de la semaine */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h4 className="font-bold text-slate-900 text-sm">
            Semaine du {formatDateFR(week.weekStartDate)} au {formatDateFR(week.weekEndDate)}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {journal && (
            <span className={cn("px-2 py-0.5 rounded font-bold uppercase", journalStatus?.color || "bg-slate-100 text-slate-700")}>
              {journalStatus?.label || journal.status}
            </span>
          )}
          {fiches.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
              {fiches.length} fiche(s)
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* === CARTE CAHIER JOURNAL === */}
        {journal ? (
          <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3 flex items-start gap-3">
            <div className="flex-shrink-0">
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-slate-900 text-sm mb-1">Cahier Journal</h5>
              {journal.className && (
                <p className="text-[11px] text-slate-600 mb-1">
                  Classe : <strong>{journal.className}</strong>
                </p>
              )}
              {journal.teacherFirstName && (
                <p className="text-[10px] text-slate-500">
                  Titulaire : {journal.teacherFirstName} {journal.teacherLastName || ""}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <button
                  onClick={() => onViewJournal(week)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded border border-blue-200"
                  title="Voir le cahier journal (grille hebdo)"
                >
                  <Eye className="h-3 w-3" /> Voir
                </button>
                <button
                  onClick={() => onExportJournalPDF(journal.id, journal.className)}
                  disabled={exportingId === journal.id}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 disabled:opacity-50"
                  title="Télécharger le cahier journal en PDF"
                >
                  {exportingId === journal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
                </button>
                <button
                  onClick={() => onReuseJournal(journal.id)}
                  disabled={duplicatingIds.has(journal.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-200 disabled:opacity-50"
                  title="Réutiliser ce cahier journal pour l'année courante"
                >
                  {duplicatingIds.has(journal.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} Réutiliser
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-slate-300" />
            <div className="text-xs text-slate-500">
              <p className="font-medium">Pas de cahier journal pour cette semaine</p>
              <p className="text-[10px] text-slate-400">(semaine avec fiche(s) non rattachée(s))</p>
            </div>
          </div>
        )}

        {/* === CARTE FICHES PÉDAGOGIQUES === */}
        {fiches.length > 0 ? (
          <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h5 className="font-bold text-slate-900 text-sm">Fiches pédagogiques jointes</h5>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                {fiches.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {fiches.map((fiche: any) => {
                const sheetInfo = SHEET_LABELS[fiche.sheetType] || { label: fiche.sheetType, icon: FileText, color: "bg-slate-100 text-slate-700" };
                const SheetIcon = sheetInfo.icon;
                const ficheStatus = STATUS_BADGES[fiche.status] || STATUS_BADGES.DRAFT;
                return (
                  <div key={fiche.id} className="flex items-center gap-2 bg-white rounded border border-emerald-100 p-2">
                    <SheetIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", sheetInfo.color)}>
                          {sheetInfo.label}
                        </span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", ficheStatus.color)}>
                          {ficheStatus.label}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {fiche.titre || fiche.cours || "Sans titre"}
                      </p>
                      {fiche.lessonDate && (
                        <p className="text-[9px] text-slate-400">
                          {formatDateFR(fiche.lessonDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onViewFiche(fiche.id)}
                        className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        title="Voir la fiche en détail"
                      >
                        <Eye className="h-2.5 w-2.5" /> Voir
                      </button>
                      <button
                        onClick={() => onExportFichePDF(fiche.id, fiche.sheetType)}
                        disabled={exportingId === fiche.id}
                        className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 disabled:opacity-50"
                        title="Télécharger la fiche en PDF"
                      >
                        {exportingId === fiche.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />} PDF
                      </button>
                      <button
                        onClick={() => onReuseFiche(fiche.id, fiche.sheetType)}
                        disabled={duplicatingIds.has(fiche.id)}
                        className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 disabled:opacity-50"
                        title="Réutiliser cette fiche pour l'année courante"
                      >
                        {duplicatingIds.has(fiche.id) ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />} Réutiliser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 flex items-center gap-3">
            <FileText className="h-8 w-8 text-slate-300" />
            <div className="text-xs text-slate-500">
              <p className="font-medium">Aucune fiche pédagogique jointe</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANT : CahierJournalViewer — Affichage inline read-only d'un cahier journal
// ============================================================================

function CahierJournalViewer({
  journal,
  onBack,
  onExportPDF,
  exporting,
}: {
  journal: any;
  onBack: () => void;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  // Le journal peut venir soit de `week.cahierJournal` (depuis le catalogue)
  // soit directement de la réponse `duplicateCahierJournalToYear` (un objet cahier journal complet)
  const journalData = journal.cahierJournal || journal;
  const className = journalData.className || "—";
  const weekStart = journal.weekStartDate || journalData.weekStartDate;
  const weekEnd = journal.weekEndDate || journalData.weekEndDate;
  const status = journalData.status || "DRAFT";
  const entries = journalData.entries || {};
  const observations = journalData.observations || "";
  const statusInfo = STATUS_BADGES[status] || STATUS_BADGES.DRAFT;

  // Parser entries : { lundi: { francais: "...", ... }, mardi: {...}, ... }
  const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
  const dayLabels: Record<string, string> = {
    lundi: "LUNDI", mardi: "MARDI", mercredi: "MERCREDI", jeudi: "JEUDI", vendredi: "VENDREDI",
  };

  // Extraire la liste des matières (clés) présentes dans entries (union de tous les jours)
  const subjectsSet = new Set<string>();
  for (const day of days) {
    const dayEntries = entries[day] || {};
    for (const key of Object.keys(dayEntries)) {
      // Ignorer les clés qui commencent par underscore (champs techniques comme _directorObservation)
      if (!key.startsWith("_") && !key.startsWith("director")) {
        subjectsSet.add(key);
      }
    }
  }
  const subjects = Array.from(subjectsSet);

  // Date de chaque jour (calculée depuis weekStart)
  const weekStartDate = new Date(weekStart);
  const dayDates: Record<string, Date> = {};
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    dayDates[days[i]] = d;
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au catalogue
        </button>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("px-2 py-1 rounded font-bold uppercase", statusInfo.color)}>
            {statusInfo.label}
          </span>
          <button
            onClick={onExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Télécharger PDF
          </button>
        </div>
      </div>

      {/* En-tête */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900">Cahier Journal</h3>
          <span className="text-xs text-slate-500">
            Semaine du <strong>{formatDateFR(weekStart)}</strong> au <strong>{formatDateFR(weekEnd)}</strong>
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Classe : <strong>{className}</strong>
          {journalData.teacherFirstName && (
            <span className="ml-3">Titulaire : <strong>{journalData.teacherFirstName} {journalData.teacherLastName || ""}</strong></span>
          )}
        </p>
      </div>

      {/* Grille hebdo (read-only) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20 sticky left-0 bg-slate-100 z-10">
                  Jours
                </th>
                {subjects.map(subj => (
                  <th key={subj} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase align-top" style={{ minWidth: "140px" }}>
                    {subj.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dayEntries = entries[day] || {};
                const date = dayDates[day];
                return (
                  <tr key={day} className="hover:bg-slate-50/50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {dayLabels[day]}
                      {date && (
                        <div className="text-[10px] text-slate-400 mt-1 font-normal normal-case">
                          {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        </div>
                      )}
                    </td>
                    {subjects.map(subj => {
                      const content = dayEntries[subj];
                      return (
                        <td key={subj} className="border border-slate-300 px-2 py-2 text-xs text-slate-700 align-top" style={{ minHeight: "60px" }}>
                          {content ? (
                            <div dangerouslySetInnerHTML={{ __html: content }} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observations */}
      {observations && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase mb-2">Observations</h4>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{observations}</p>
        </div>
      )}

      {/* Note info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>ℹ️ Lecture seule.</strong> Ce cahier journal provient du catalogue. Pour le modifier, utilisez le bouton{" "}
        <strong className="font-bold">« Réutiliser »</strong> qui crée une copie pour l'année courante.
      </div>
    </div>
  );
}
