"use client";

/**
 * ============================================================================
 * MATERIALS WORKSPACE — Inventaire du Matériel Pédagogique (Refonte 2026-08-20)
 * ============================================================================
 *
 * Refonte : design uniformisé avec les autres onglets (table-based, modales
 * simples), CRUD fonctionnel via fetch direct au BFF (PLUS de pedagogyService
 * offline mode qui cassait les opérations sur web).
 *
 * Champs affichés :
 *   - Code, Nom, Catégorie, Niveau scolaire, Matière, Description
 *   - Stock total, Stock disponible (par année scolaire)
 *   - Statut actif/inactif
 *
 * CRUD :
 *   - Créer un matériel (modal FormModal)
 *   - Modifier un matériel
 *   - Supprimer un matériel (confirm dialog)
 *   - Ajouter du stock (crée un mouvement PURCHASE)
 *
 * Backend :
 *   GET    /api/pedagogy/pedagogical-materials?academicYearId=
 *   POST   /api/pedagogy/pedagogical-materials
 *   PUT    /api/pedagogy/pedagogical-materials/:id
 *   DELETE /api/pedagogy/pedagogical-materials/:id
 *   POST   /api/pedagogy/material-movements (movementType=PURCHASE pour ajouter stock)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Plus, RefreshCw, Search, Filter, Package,
  BookOpen, FlaskConical, Monitor, FileText, Edit, Trash2,
  CheckCircle2, XCircle, AlertCircle, X, Save, ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

const CATEGORIES = [
  { id: "BOOK", label: "Manuel scolaire", icon: BookOpen, color: "text-indigo-700 bg-indigo-50" },
  { id: "TEACHER_GUIDE", label: "Guide pédagogique", icon: BookOpen, color: "text-rose-700 bg-rose-50" },
  { id: "OFFICIAL_DOCUMENT", label: "Document officiel", icon: FileText, color: "text-blue-700 bg-blue-50" },
  { id: "DIDACTIC_SUPPORT", label: "Support didactique", icon: Monitor, color: "text-emerald-700 bg-emerald-50" },
  { id: "LAB_MATERIAL", label: "Matériel de laboratoire", icon: FlaskConical, color: "text-amber-700 bg-amber-50" },
  { id: "OTHER", label: "Autre", icon: Package, color: "text-slate-700 bg-slate-50" },
];

function getCategoryConfig(cat: string) {
  return CATEGORIES.find((c) => c.id === cat) || CATEGORIES.find((c) => c.id === "OTHER")!;
}

interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  schoolLevelId: string;
  subjectId?: string;
  isActive: boolean;
  schoolLevel?: { id: string; name: string; code: string };
  subject?: { id: string; name: string; code: string };
  stocks?: Array<{
    id: string;
    quantityTotal: number;
    quantityAvailable: number;
    academicYearId: string;
  }>;
}

export default function MaterialsWorkspace() {
  const { user } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [stockTarget, setStockTarget] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "BOOK",
    description: "",
    schoolLevelId: "",
    subjectId: "",
    isActive: true,
  });
  const [stockData, setStockData] = useState({
    quantity: 10,
    notes: "",
  });

  // === Charger les niveaux scolaires ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy/academic-structure/levels`, {
          credentials: "include",
        });
        const data = await res.json();
        setSchoolLevels(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      } catch { setSchoolLevels([]); }
    })();
  }, []);

  // === Charger les matières (avec academicYearId obligatoire) ===
  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy/subjects?academicYearId=${encodeURIComponent(academicYear.id)}`,
          { credentials: "include" },
        );
        const data = await res.json();
        setSubjects(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      } catch { setSubjects([]); }
    })();
  }, [academicYear?.id]);

  // === Charger les matériaux ===
  const loadMaterials = useCallback(async () => {
    if (!academicYear?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      const res = await fetch(
        `/api/pedagogy/pedagogical-materials?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      // Accepter les 2 formats : array direct OU { data: [...] }
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setMaterials(arr);
    } catch (e) {
      console.error(e);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  // === Filtrer les matériaux ===
  const filteredMaterials = materials.filter((m) => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || m.category === filterCategory;
    const matchLevel = !filterLevel || m.schoolLevelId === filterLevel;
    return matchSearch && matchCat && matchLevel;
  });

  // === Ouvrir modal création ===
  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({
      code: "",
      name: "",
      category: "BOOK",
      description: "",
      schoolLevelId: schoolLevel?.id || schoolLevels[0]?.id || "",
      subjectId: "",
      isActive: true,
    });
    setShowFormModal(true);
  };

  // === Ouvrir modal édition ===
  const openEditModal = (m: Material) => {
    setEditingMaterial(m);
    setFormData({
      code: m.code || "",
      name: m.name || "",
      category: m.category || "BOOK",
      description: m.description || "",
      schoolLevelId: m.schoolLevelId || "",
      subjectId: m.subjectId || "",
      isActive: m.isActive,
    });
    setShowFormModal(true);
  };

  // === Soumettre formulaire (création ou édition) ===
  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.name.trim() || !formData.schoolLevelId) {
      toast.error("Code, nom et niveau scolaire sont obligatoires");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description || undefined,
        schoolLevelId: formData.schoolLevelId,
        subjectId: formData.subjectId || undefined,
        isActive: formData.isActive,
      };
      const url = editingMaterial
        ? `/api/pedagogy/pedagogical-materials/${editingMaterial.id}`
        : `/api/pedagogy/pedagogical-materials`;
      const method = editingMaterial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success(editingMaterial ? "Matériel modifié" : "Matériel créé");
      setShowFormModal(false);
      setEditingMaterial(null);
      loadMaterials();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Supprimer ===
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetch(`/api/pedagogy/pedagogical-materials/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Matériel supprimé");
      setDeleteTarget(null);
      loadMaterials();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Ajouter du stock (crée un mouvement PURCHASE) ===
  const handleAddStock = async () => {
    if (!stockTarget || !academicYear?.id) return;
    if (!stockData.quantity || stockData.quantity <= 0) {
      toast.error("La quantité doit être supérieure à 0");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy/material-movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          materialId: stockTarget.id,
          academicYearId: academicYear.id,
          movementType: "PURCHASE",
          quantity: stockData.quantity,
          notes: stockData.notes || undefined,
          schoolLevelId: stockTarget.schoolLevelId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success(`+${stockData.quantity} ajouté au stock`);
      setStockTarget(null);
      setStockData({ quantity: 10, notes: "" });
      loadMaterials();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Statistiques globales ===
  const totalMaterials = materials.length;
  const totalStock = materials.reduce((sum, m) => {
    const stock = m.stocks?.find((s) => s.academicYearId === academicYear?.id);
    return sum + (stock?.quantityTotal ?? 0);
  }, 0);
  const totalAvailable = materials.reduce((sum, m) => {
    const stock = m.stocks?.find((s) => s.academicYearId === academicYear?.id);
    return sum + (stock?.quantityAvailable ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* === En-tête + actions === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Inventaire du matériel pédagogique</div>
            <div className="text-xs text-slate-500">
              {totalMaterials} type(s) · {totalStock} en stock · {totalAvailable} disponible(s)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMaterials}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Nouveau matériel
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
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[180px]"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[150px]"
        >
          <option value="">Tous niveaux</option>
          {schoolLevels.map((l: any) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* === Table des matériaux === */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {materials.length === 0 ? "Aucun matériel enregistré" : "Aucun matériel ne correspond aux filtres"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {materials.length === 0
              ? "Cliquez sur \"Nouveau matériel\" pour commencer l'inventaire."
              : "Modifiez vos filtres ou réinitialisez-les."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Code</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Nom</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Catégorie</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Niveau</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matière</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Stock total</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Dispo.</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Actif</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((m) => {
                const cat = getCategoryConfig(m.category);
                const CatIcon = cat.icon;
                const stock = m.stocks?.find((s) => s.academicYearId === academicYear?.id);
                const totalStock = stock?.quantityTotal ?? 0;
                const available = stock?.quantityAvailable ?? 0;
                return (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-mono text-slate-700">{m.code}</td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-900">
                      {m.name}
                      {m.description && (
                        <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{m.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", cat.color)}>
                        <CatIcon className="h-3 w-3" />
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {m.schoolLevel?.name || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {m.subject?.name || "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">{totalStock}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-emerald-700">{available}</td>
                    <td className="px-3 py-2 text-center">
                      {m.isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setStockTarget(m)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Ajouter du stock"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === MODAL : Formulaire création/édition === */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-blue-50 border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingMaterial ? "Modifier le matériel" : "Nouveau matériel pédagogique"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingMaterial ? `Code : ${editingMaterial.code}` : "Renseignez les informations du matériel"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowFormModal(false); setEditingMaterial(null); }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: MANuel-FR-6A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Catégorie</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Manuel de Français 6e — Collection Édicef"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Niveau scolaire *</label>
                  <select
                    value={formData.schoolLevelId}
                    onChange={(e) => setFormData({ ...formData, schoolLevelId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— Sélectionner —</option>
                    {schoolLevels.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Matière (optionnel)</label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— Aucune —</option>
                    {subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Ex: Manuel de 152 pages, illustré, conforme au programme officiel..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                Matériel actif (visible dans les distributions)
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setShowFormModal(false); setEditingMaterial(null); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.code.trim() || !formData.name.trim() || !formData.schoolLevelId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingMaterial ? "Enregistrer" : "Créer le matériel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL : Ajouter du stock === */}
      {stockTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-3">
                <ArrowUp className="h-8 w-8 text-emerald-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Ajouter du stock</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{stockTarget.name} ({stockTarget.code})</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                Cette opération crée un mouvement de type <strong>PURCHASE</strong> (achat/réapprovisionnement)
                qui augmentera le stock total et disponible pour l'année en cours.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Quantité à ajouter *</label>
                <input
                  type="number"
                  min={1}
                  value={stockData.quantity}
                  onChange={(e) => setStockData({ ...stockData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Notes (optionnel)</label>
                <textarea
                  value={stockData.notes}
                  onChange={(e) => setStockData({ ...stockData, notes: e.target.value })}
                  rows={3}
                  placeholder="Ex: Achat effectué le... — Fournisseur:..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setStockTarget(null); setStockData({ quantity: 10, notes: "" }); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAddStock}
                disabled={saving || !stockData.quantity}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                Ajouter au stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL : Confirmation suppression === */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <div className="flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-rose-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Supprimer le matériel</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.name} ({deleteTarget.code})</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700">
                Vous êtes sur le point de supprimer définitivement ce matériel pédagogique.
                Cette action est irréversible.
              </p>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Si du stock existe pour ce matériel, il sera également supprimé. Les affectations
                  aux enseignants ne seront pas supprimées (conservées pour l'historique).
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
