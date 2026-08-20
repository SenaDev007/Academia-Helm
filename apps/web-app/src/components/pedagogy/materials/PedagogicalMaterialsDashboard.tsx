"use client";

/**
 * ============================================================================
 * PEDAGOGICAL MATERIALS DASHBOARD — 4 sous-onglets
 * ============================================================================
 *
 * Architecture :
 *   1. Inventaire   — Catalogue du matériel (livres, kits, labo) + stocks par année
 *   2. Distribution  — Affectations aux enseignants (par classe + par matière)
 *   3. Retour        — Soumissions en attente (SUBMITTED) → valider / refuser
 *   4. Historique    — Vue annuelle filtrable par enseignant + classe
 *
 * Backend :
 *   /api/pedagogy/pedagogical-materials/*   — Inventaire
 *   /api/pedagogy/teacher-material-assignments/*  — Distribution
 *   /api/pedagogy/material-returns/*        — Retour + Historique
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Package, ClipboardList, Undo2, History, Loader2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Search, Filter, Send,
  Plus, X, Layers, FileText, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { cn } from "@/lib/utils";
import MaterialsWorkspace from "@/components/pedagogy/materials/MaterialsWorkspace";

const cn2 = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

const SUB_TABS = [
  { id: "inventaire", label: "Inventaire", icon: Package },
  { id: "distribution", label: "Distribution aux enseignants", icon: ClipboardList },
  { id: "retour", label: "Retour", icon: Undo2 },
  { id: "suivi", label: "Suivi des retours", icon: CheckCircle2 },
  { id: "historique", label: "Historique", icon: History },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

const CATEGORY_LABELS: Record<string, string> = {
  BOOK: "Manuel scolaire",
  TEACHER_GUIDE: "Guide pédagogique",
  OFFICIAL_DOCUMENT: "Document officiel",
  DIDACTIC_SUPPORT: "Support didactique",
  LAB_MATERIAL: "Matériel de laboratoire",
  OTHER: "Autre",
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: "Neuf",
  GOOD: "Bon état",
  USED: "Usé",
  DAMAGED: "Endommagé",
  LOST: "Perdu",
};

const RETURN_STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "En attente", color: "bg-slate-100 text-slate-700", icon: AlertCircle },
  SUBMITTED: { label: "Soumis", color: "bg-amber-100 text-amber-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Refusé", color: "bg-rose-100 text-rose-700", icon: XCircle },
};

export function PedagogicalMaterialsDashboard() {
  const { user } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const [activeTab, setActiveTab] = useState<SubTabId>("inventaire");

  return (
    <div className="space-y-4">
      {/* === Sous-onglets === */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn2(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white shadow text-blue-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* === Contenu === */}
      {activeTab === "inventaire" && <MaterialsWorkspace />}

      {activeTab === "distribution" && (
        <DistributionView
          academicYearId={academicYear?.id ?? ""}
          schoolLevelId={schoolLevel?.id}
          user={user}
        />
      )}

      {activeTab === "retour" && (
        <ReturnsView
          academicYearId={academicYear?.id ?? ""}
          user={user}
        />
      )}

      {activeTab === "suivi" && (
        <SuiviRetoursView
          academicYearId={academicYear?.id ?? ""}
        />
      )}

      {activeTab === "historique" && (
        <HistoryView
          academicYearId={academicYear?.id ?? ""}
        />
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 2 : DISTRIBUTION (liste des affectations par enseignant)
// ============================================================================

interface DistributionViewProps {
  academicYearId: string;
  schoolLevelId?: any;
  user: any;
}

function DistributionView({ academicYearId, user }: DistributionViewProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Filtres
  const [searchTeacher, setSearchTeacher] = useState("");
  const [filterLevelId, setFilterLevelId] = useState("");

  // Modal de distribution (multi-sélection par checkboxes)
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  // ⭐ Liste des items sélectionnés : { materialId, quantity, conditionAtIssue }
  //    Chaque case cochée crée une entrée → soumission en lot à la validation
  const [selectedItems, setSelectedItems] = useState<Record<string, { quantity: number; conditionAtIssue: string }>>({});
  const [distributeClassId, setDistributeClassId] = useState("");
  const [distributeNotes, setDistributeNotes] = useState("");

  // === Charger les enseignants groupés par niveau scolaire ===
  const loadTeachers = useCallback(async () => {
    if (!academicYearId) return;
    try {
      const res = await fetch(
        `/api/pedagogy/material-returns/teachers-by-level?academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setTeacherGroups(Array.isArray(data) ? data : []);
    } catch { setTeacherGroups([]); }
  }, [academicYearId]);

  // === Charger les affectations existantes ===
  const loadAssignments = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      params.append("page", "1");
      // ⭐ Backend PaginationDto limite à 100 max (sinon 400 Bad Request).
      //    Si > 100 affectations, paginer ou implémenter scroll infini.
      params.append("limit", "100");
      const res = await fetch(
        `/api/pedagogy/teacher-material-assignments?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setAssignments(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch { setAssignments([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  // === Charger les matériels (pour le select du formulaire) ===
  const loadMaterials = useCallback(async () => {
    if (!academicYearId) return;
    try {
      const res = await fetch(
        `/api/pedagogy/pedagogical-materials?academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setMaterials(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch { setMaterials([]); }
  }, [academicYearId]);

  // === Charger les classes pour le select ===
  const loadClasses = useCallback(async () => {
    if (!academicYearId) return;
    try {
      const res = await fetch(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYearId}`, {
        credentials: "include",
      });
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
    } catch { setClasses([]); }
  }, [academicYearId]);

  useEffect(() => {
    loadTeachers();
    loadAssignments();
    loadMaterials();
    loadClasses();
  }, [loadTeachers, loadAssignments, loadMaterials, loadClasses]);

  // === Ouvrir le modal de distribution ===
  const openDistributeModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedItems({});
    setDistributeClassId("");
    setDistributeNotes("");
    setShowDistributeModal(true);
  };

  // === Bascule la sélection d'un matériel (checkbox) ===
  const toggleMaterial = (materialId: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[materialId]) {
        delete next[materialId];
      } else {
        next[materialId] = { quantity: 1, conditionAtIssue: "NEW" };
      }
      return next;
    });
  };

  // === Met à jour la quantité d'un matériel sélectionné ===
  const updateItemQuantity = (materialId: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [materialId]: { ...prev[materialId], quantity: Math.max(1, quantity) },
    }));
  };

  // === Met à jour l'état d'un matériel sélectionné ===
  const updateItemCondition = (materialId: string, conditionAtIssue: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [materialId]: { ...prev[materialId], conditionAtIssue },
    }));
  };

  // === Soumettre la distribution (POST affectations en lot) ===
  const handleDistribute = async () => {
    if (!selectedTeacher) {
      toast.error("Aucun enseignant sélectionné");
      return;
    }
    const entries = Object.entries(selectedItems);
    if (entries.length === 0) {
      toast.error("Veuillez cocher au moins un matériel à distribuer");
      return;
    }
    setSaving(true);
    try {
      // Soumettre chaque affectation séquentiellement (POST × N)
      const results = await Promise.allSettled(
        entries.map(([materialId, data]) =>
          fetch(`/api/pedagogy/teacher-material-assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              teacherId: selectedTeacher.id,
              materialId,
              classId: distributeClassId || undefined,
              quantity: data.quantity,
              conditionAtIssue: data.conditionAtIssue,
              notes: distributeNotes || undefined,
              academicYearId,
              schoolLevelId: selectedTeacher.schoolLevelId || undefined,
            }),
          })
        )
      );
      const successCount = results.filter(r => r.status === "fulfilled" && (r.value as Response).ok).length;
      const failedCount = results.length - successCount;
      if (failedCount === 0) {
        toast.success(`✅ ${successCount} matériel(s) distribué(s) à ${selectedTeacher.fullName}`);
      } else {
        toast.warning(`${successCount} réussi(s), ${failedCount} échec(s)`);
      }
      setShowDistributeModal(false);
      setSelectedTeacher(null);
      setSelectedItems({});
      loadAssignments();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Export PDF État des distributions ===
  const exportDistributionPdf = async () => {
    if (!academicYearId) return;
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      const res = await fetch(
        `/api/pedagogy/material-returns/distribution-pdf?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erreur génération PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etat_distributions_materiel.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF distributions généré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setExportingPdf(false);
    }
  };

  // Filtrer les enseignants par recherche + niveau
  const filteredGroups = teacherGroups
    .filter((g: any) => !filterLevelId || g.schoolLevelId === filterLevelId)
    .map((g: any) => ({
      ...g,
      teachers: (g.teachers || []).filter((t: any) =>
        !searchTeacher ||
        t.fullName?.toLowerCase().includes(searchTeacher.toLowerCase()) ||
        t.email?.toLowerCase().includes(searchTeacher.toLowerCase()) ||
        t.matricule?.toLowerCase().includes(searchTeacher.toLowerCase())
      ),
    }))
    .filter((g: any) => g.teachers.length > 0);

  // Calculer le nombre d'affectations par enseignant
  const getAssignmentsForTeacher = (teacherId: string) => {
    return assignments.filter((a) => a.teacherId === teacherId);
  };

  // ⭐ Afficher TOUS les matériels du tenant (sans filtrer par niveau scolaire
  //    du teacher), avec badge indiquant le niveau de chaque matériel.
  //    L'utilisateur peut ainsi distribuer n'importe quel matériel à n'importe
  //    quel enseignant (cas d'usage : prof de remplacement multi-niveaux).
  const allMaterials = materials;

  return (
    <div className="space-y-4">
      {/* === En-tête + actions === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Distribution aux enseignants</div>
            <div className="text-xs text-slate-500">
              {assignments.length} affectation(s) — {teacherGroups.reduce((s: number, g: any) => s + g.teachers.length, 0)} enseignant(s)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadTeachers(); loadAssignments(); }}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportDistributionPdf}
            disabled={exportingPdf || !academicYearId}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            title="PDF État des distributions"
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF Distributions
          </button>
        </div>
      </div>

      {/* === Filtres === */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4" />
          Filtrer
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un enseignant par nom, email, matricule..."
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterLevelId}
          onChange={(e) => setFilterLevelId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[150px]"
        >
          <option value="">Tous les niveaux</option>
          {teacherGroups.map((g: any) => (
            <option key={g.schoolLevelId || "_no_level"} value={g.schoolLevelId || ""}>
              {g.schoolLevelName}
            </option>
          ))}
        </select>
      </div>

      {/* === Contenu === */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {teacherGroups.length === 0 ? "Aucun enseignant trouvé" : "Aucun enseignant ne correspond aux filtres"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Les enseignants apparaîtront ici dès qu'ils auront un profil Teacher avec un niveau scolaire.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group: any) => (
            <div key={group.schoolLevelId || "_no_level"} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* En-tête niveau */}
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-indigo-900 text-sm">{group.schoolLevelName}</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                  {group.teachers.length} enseignant(s)
                </span>
              </div>
              {/* Liste des enseignants */}
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Enseignant</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matricule</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Email</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Affectations</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.teachers.map((t: any) => {
                    const teacherAssignments = getAssignmentsForTeacher(t.id);
                    return (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-sm font-medium text-slate-900">
                          {t.fullName}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                          {t.matricule || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {t.email || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn2(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            teacherAssignments.length > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          )}>
                            {teacherAssignments.length} matériel(s)
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => openDistributeModal({ ...t, schoolLevelId: group.schoolLevelId })}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold mx-auto"
                          >
                            <Plus className="h-3 w-3" />
                            Distribuer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Affectations existantes pour ce groupe (si search vide) */}
              {!searchTeacher && assignments.filter((a) => {
                const teacher = group.teachers.find((t: any) => t.id === a.teacherId);
                return !!teacher;
              }).length > 0 && (
                <div className="p-3 bg-slate-50/30 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                    Affectations existantes — {group.schoolLevelName}
                  </div>
                  <div className="space-y-1">
                    {assignments
                      .filter((a) => group.teachers.some((t: any) => t.id === a.teacherId))
                      .map((a: any) => {
                        const teacher = group.teachers.find((t: any) => t.id === a.teacherId);
                        return (
                          <div key={a.id} className="flex items-center justify-between text-xs px-2 py-1 bg-white rounded border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {a.material?.name || "—"}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{teacher?.fullName}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{a.quantity} unité(s)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {a.signed ? (
                                <span className="text-emerald-600 font-semibold text-[10px]">✓ Signé</span>
                              ) : (
                                <span className="text-amber-600 text-[10px]">En attente signature</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === MODAL : Distribuer du matériel === */}
      {showDistributeModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-blue-50 border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Distribuer du matériel</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    À : <strong>{selectedTeacher.fullName}</strong>
                    {selectedTeacher.schoolLevelName && ` (${selectedTeacher.schoolLevelName})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowDistributeModal(false); setSelectedTeacher(null); setSelectedItems({}); }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Résumé sélection */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
                <div>
                  <strong>ℹ️ Après validation :</strong> l'enseignant verra ce matériel dans son Espace Pédagogique
                  → onglet Matériel. Il pourra signer la réception et générer un PDF.
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{Object.keys(selectedItems).length}</div>
                  <div className="text-[10px]">sélectionné(s)</div>
                </div>
              </div>

              {/* Liste des matériels avec checkboxes */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                  Cochez les matériels à distribuer *
                </label>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  {allMaterials.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      Aucun matériel dans l'inventaire.
                      <br />
                      Créez-en depuis l'onglet Inventaire d'abord.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr className="border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-12">✓</th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Matériel</th>
                          <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-20">Dispo.</th>
                          <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-20">Qté</th>
                          <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-32">État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allMaterials.map((m: any) => {
                          const stock = m.stocks?.find((s: any) => s.academicYearId === academicYearId);
                          const available = stock?.quantityAvailable ?? 0;
                          const isChecked = !!selectedItems[m.id];
                          const isOutOfStock = available <= 0;
                          return (
                            <tr key={m.id} className={cn2(
                              "border-b border-slate-100",
                              isChecked ? "bg-blue-50/50" : "hover:bg-slate-50",
                              isOutOfStock && "opacity-50"
                            )}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMaterial(m.id)}
                                  disabled={isOutOfStock}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm">
                                <div className="font-medium text-slate-900">{m.name}</div>
                                <div className="text-[10px] text-slate-500">
                                  [{m.code}] · {m.category}
                                  {m.schoolLevel?.name && ` · ${m.schoolLevel.name}`}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-sm font-bold text-slate-700">
                                {available}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={available}
                                  value={selectedItems[m.id]?.quantity ?? 1}
                                  onChange={(e) => updateItemQuantity(m.id, parseInt(e.target.value) || 1)}
                                  disabled={!isChecked}
                                  className={cn2(
                                    "w-14 px-2 py-1 border border-slate-200 rounded text-center text-sm font-bold",
                                    !isChecked && "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  )}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={selectedItems[m.id]?.conditionAtIssue ?? "NEW"}
                                  onChange={(e) => updateItemCondition(m.id, e.target.value)}
                                  disabled={!isChecked}
                                  className={cn2(
                                    "px-2 py-1 border border-slate-200 rounded text-[10px]",
                                    !isChecked && "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  )}
                                >
                                  <option value="NEW">Neuf</option>
                                  <option value="GOOD">Bon état</option>
                                  <option value="USED">Usé</option>
                                  <option value="DAMAGED">Endommagé</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Classe commune + Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Classe commune (optionnel)</label>
                  <select
                    value={distributeClassId}
                    onChange={(e) => setDistributeClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— Aucune —</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name || c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Notes (optionnel)</label>
                  <input
                    type="text"
                    value={distributeNotes}
                    onChange={(e) => setDistributeNotes(e.target.value)}
                    placeholder="Ex: Remis en main propre le..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setShowDistributeModal(false); setSelectedTeacher(null); setSelectedItems({}); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDistribute}
                disabled={saving || Object.keys(selectedItems).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Valider la distribution ({Object.keys(selectedItems).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 3 : RETOUR (soumissions en attente + validation)
// ============================================================================

interface ReturnsViewProps {
  academicYearId: string;
  user: any;
}

function ReturnsView({ academicYearId, user }: ReturnsViewProps) {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [validationModal, setValidationModal] = useState<any | null>(null);
  const [lostQty, setLostQty] = useState(0);
  const [lostNotes, setLostNotes] = useState("");
  const [rejectionModal, setRejectionModal] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadPending = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy/material-returns/pending?academicYearId=${academicYearId}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setPending(Array.isArray(data) ? data : []);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // Groupé par enseignant
  const byTeacher = pending.reduce((acc, r) => {
    const key = r.teacherId || "_unknown";
    if (!acc[key]) {
      acc[key] = {
        teacherId: r.teacherId,
        teacherName: `${r.teacherFirstName ?? ""} ${r.teacherLastName ?? ""}`.trim() || "—",
        teacherMatricule: r.teacherMatricule,
        items: [],
        signatureUrl: r.returnSignatureUrl,
      };
    }
    acc[key].items.push(r);
    if (!acc[key].signatureUrl && r.returnSignatureUrl) {
      acc[key].signatureUrl = r.returnSignatureUrl;
    }
    return acc;
  }, {} as Record<string, any>);

  const teacherGroups = Object.values(byTeacher);

  const handleValidate = async (item: any) => {
    setActionId(item.id);
    try {
      const res = await fetch(`/api/pedagogy/material-returns/${item.id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          validatedBy: user?.id,
          lostQuantity: lostQty,
          lostNotes: lostNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success("Retour validé");
      setValidationModal(null);
      setLostQty(0);
      setLostNotes("");
      loadPending();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (item: any) => {
    if (!rejectionReason.trim()) {
      toast.error("Veuillez saisir un motif de refus");
      return;
    }
    setActionId(item.id);
    try {
      const res = await fetch(`/api/pedagogy/material-returns/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          validatedBy: user?.id,
          rejectionReason,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success("Retour refusé — l'enseignant peut corriger et resoumettre");
      setRejectionModal(null);
      setRejectionReason("");
      loadPending();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-amber-700" />
          <div>
            <div className="text-sm font-bold text-amber-900">Soumissions en attente de validation</div>
            <div className="text-xs text-amber-700">
              Les enseignants ont soumis leurs retours signés. Validez-les un par un ou refusez-les avec un motif.
            </div>
          </div>
        </div>
        <button
          onClick={loadPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : teacherGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune soumission en attente</p>
          <p className="text-xs text-slate-400 mt-1">
            Les soumissions apparaîtront ici lorsque les enseignants cliqueront "Envoyer".
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teacherGroups.map((group: any) => (
            <div key={group.teacherId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{group.teacherName}</div>
                  {group.teacherMatricule && (
                    <div className="text-xs text-slate-500">Matricule : {group.teacherMatricule}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    {group.items.length} matériel(s)
                  </span>
                  {group.signatureUrl && (
                    <div className="border-b border-slate-700 pb-0.5">
                      <img src={group.signatureUrl} alt="Signature" className="max-h-10" />
                    </div>
                  )}
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matériel</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Qté attribuée</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Retourné</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Perdu</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">État</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Notes</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">
                        {item.materialName || "—"}
                        {item.materialCode && (
                          <span className="text-[10px] text-slate-400 ml-1">[{item.materialCode}]</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">{item.quantity}</td>
                      <td className="px-3 py-2 text-center text-sm font-bold text-emerald-700">
                        {item.returnQuantity ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold text-rose-700">
                        {item.lostQuantity ?? (item.quantity - (item.returnQuantity ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {CONDITION_LABELS[item.returnCondition] || item.returnCondition || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">
                        {item.returnNotes || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setValidationModal(item);
                              setLostQty(item.lostQuantity ?? (item.quantity - (item.returnQuantity ?? 0)));
                              setLostNotes("");
                            }}
                            disabled={actionId === item.id}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold disabled:opacity-50"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => {
                              setRejectionModal(item);
                              setRejectionReason("");
                            }}
                            disabled={actionId === item.id}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-semibold disabled:opacity-50"
                          >
                            Refuser
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* === MODAL : Validation retour === */}
      {validationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-emerald-50 border-emerald-200">
              <h3 className="text-lg font-bold text-slate-900">Valider le retour</h3>
              <p className="text-xs text-slate-500 mt-0.5">{validationModal.materialName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Quantité attribuée</div>
                  <div className="text-lg font-bold text-slate-900">{validationModal.quantity}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Quantité retournée</div>
                  <div className="text-lg font-bold text-emerald-700">{validationModal.returnQuantity ?? 0}</div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                  Quantité perdue (non retournée)
                </label>
                <input
                  type="number"
                  min={0}
                  max={validationModal.quantity}
                  value={lostQty}
                  onChange={(e) => setLostQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                  Notes sur les pertes (optionnel)
                </label>
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex : 2 manuels manquants — élève parti sans rendre..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setValidationModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg">
                Annuler
              </button>
              <button
                onClick={() => handleValidate(validationModal)}
                disabled={actionId === validationModal.id}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {actionId === validationModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL : Refus retour === */}
      {rejectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <h3 className="text-lg font-bold text-slate-900">Refuser le retour</h3>
              <p className="text-xs text-slate-500 mt-0.5">{rejectionModal.materialName}</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                L'enseignant devra corriger sa déclaration et resoumettre. Indiquez un motif clair.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Motif du refus *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Ex : Quantité retournée incorrecte — état du matériel non précisé..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setRejectionModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg">
                Annuler
              </button>
              <button
                onClick={() => handleReject(rejectionModal)}
                disabled={actionId === rejectionModal.id}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {actionId === rejectionModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 4 : HISTORIQUE (vue annuelle filtrable)
// ============================================================================

interface HistoryViewProps {
  academicYearId: string;
}

function HistoryView({ academicYearId }: HistoryViewProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [classes, setClasses] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      if (filterTeacher) params.append("teacherId", filterTeacher);
      if (filterClass) params.append("classId", filterClass);
      const res = await fetch(
        `/api/pedagogy/material-returns/history?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, filterTeacher, filterClass]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!academicYearId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYearId}`, {
          credentials: "include",
        });
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      } catch { setClasses([]); }
    })();
  }, [academicYearId]);

  const filtered = items.filter((i) => !filterStatus || i.returnStatus === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4" />
          Filtres
        </div>
        <input
          type="text"
          placeholder="ID enseignant (UUID)"
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[180px]"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[180px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name || c.code}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(RETURN_STATUS_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
        <div className="ml-auto text-sm text-slate-500">
          {filtered.length} entrée(s)
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun historique trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Enseignant</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matériel</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Catégorie</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Classe</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Qté</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Retourné</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Perdu</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const statusCfg = RETURN_STATUS_LABELS[item.returnStatus] || { label: item.returnStatus, color: "bg-slate-100 text-slate-700", icon: AlertCircle };
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-medium text-slate-900">
                      {`${item.teacherFirstName ?? ""} ${item.teacherLastName ?? ""}`.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-900">
                      {item.materialName || "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-600">
                      {CATEGORY_LABELS[item.materialCategory] || item.materialCategory || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{item.className || "—"}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">{item.quantity}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-emerald-700">
                      {item.returnQuantity ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-rose-700">
                      {item.lostQuantity ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", statusCfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 4 (NOUVEAU) : SUIVI DES RETOURS — comparaison reçu vs rendu
// ============================================================================

interface SuiviRetoursViewProps {
  academicYearId: string;
}

const SUIVI_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  COMPLET: { label: "Complet", color: "bg-emerald-100 text-emerald-700" },
  PARTIEL: { label: "Partiel", color: "bg-amber-100 text-amber-700" },
  PERTE: { label: "Perte", color: "bg-rose-100 text-rose-700" },
  NON_RETOURNE: { label: "Non retourné", color: "bg-rose-100 text-rose-700" },
  EN_ATTENTE: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  AUCUN: { label: "Aucun matériel", color: "bg-slate-100 text-slate-700" },
};

function SuiviRetoursView({ academicYearId }: SuiviRetoursViewProps) {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [filterLevelId, setFilterLevelId] = useState("");
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);

  const loadComparison = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      if (filterLevelId) params.append("schoolLevelId", filterLevelId);
      const res = await fetch(
        `/api/pedagogy/material-returns/return-comparison?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setComparisons(Array.isArray(data?.comparisons) ? data.comparisons : []);
      setTotals(data?.totals || null);
    } catch {
      setComparisons([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, filterLevelId]);

  useEffect(() => { loadComparison(); }, [loadComparison]);

  useEffect(() => {
    if (!academicYearId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy/material-returns/school-levels?academicYearId=${encodeURIComponent(academicYearId)}`,
          { credentials: "include" },
        );
        const data = await res.json();
        setSchoolLevels(Array.isArray(data) ? data : []);
      } catch { setSchoolLevels([]); }
    })();
  }, [academicYearId]);

  const exportComparisonPdf = async () => {
    if (!academicYearId) return;
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      if (filterLevelId) params.append("schoolLevelId", filterLevelId);
      const res = await fetch(
        `/api/pedagogy/material-returns/comparison-pdf?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erreur génération PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparaison_retours_materiel.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF comparaison généré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Suivi des retours</div>
            <div className="text-xs text-slate-500">
              Comparaison automatique reçu vs rendu — identifie les pertes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadComparison}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportComparisonPdf}
            disabled={exportingPdf || !academicYearId}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            title="PDF rapport de comparaison"
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF Comparaison
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4" />
          Niveau
        </div>
        <select
          value={filterLevelId}
          onChange={(e) => setFilterLevelId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[150px]"
        >
          <option value="">Tous les niveaux</option>
          {schoolLevels.map((l: any) => (
            <option key={l.id} value={l.id}>{l.name || l.label || l.code}</option>
          ))}
        </select>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Enseignants" value={totals.teachersCount} color="text-slate-900" />
          <StatCard label="Total reçu" value={totals.totalReceived} color="text-slate-900" />
          <StatCard label="Total rendu" value={totals.totalReturned} color="text-emerald-700" />
          <StatCard label="Total perdu" value={totals.totalLost} color="text-rose-700" />
          <StatCard label="Complets" value={totals.completeCount} color="text-emerald-700" />
          <StatCard label="Partiels" value={totals.partialCount} color="text-amber-700" />
          <StatCard label="Pertes" value={totals.lostCount} color="text-rose-700" />
          <StatCard label="En attente" value={totals.pendingCount} color="text-amber-700" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : comparisons.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune distribution à comparer</p>
          <p className="text-xs text-slate-400 mt-1">
            Les enseignants apparaîtront ici dès qu'ils recevront du matériel.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Enseignant</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matricule</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Niveau</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Items</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Reçu</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Rendu</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Perdu</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Écart</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c: any) => {
                const cfg = SUIVI_STATUS_CONFIG[c.status] || SUIVI_STATUS_CONFIG.AUCUN;
                return (
                  <tr key={c.teacherId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-medium text-slate-900">{c.teacherName}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono">{c.teacherMatricule || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.schoolLevelName || "—"}</td>
                    <td className="px-3 py-2 text-center text-sm text-slate-600">{c.itemsCount}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">{c.totalReceived}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-emerald-700">{c.totalReturned}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-rose-700">{c.totalLost}</td>
                    <td className="px-3 py-2 text-center text-sm text-slate-700">
                      {c.difference === 0 ? "0" : `+${c.difference}`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn2("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold", cfg.color)}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200">
      <div className="text-[10px] text-slate-500 uppercase font-bold">{label}</div>
      <div className={cn2("text-2xl font-bold", color)}>{value}</div>
    </div>
  );
}
