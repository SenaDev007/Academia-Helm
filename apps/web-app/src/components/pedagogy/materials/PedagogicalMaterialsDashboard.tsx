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
  const [loading, setLoading] = useState(true);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [classes, setClasses] = useState<any[]>([]);

  const loadAssignments = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      if (filterTeacher) params.append("teacherId", filterTeacher);
      if (filterClass) params.append("classId", filterClass);
      params.append("page", "1");
      params.append("limit", "1000");

      const res = await fetch(
        `/api/pedagogy/teacher-material-assignments?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setAssignments(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, filterTeacher, filterClass]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // Charger les classes pour le filtre
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

  // Groupé par enseignant
  const byTeacher = assignments.reduce((acc, a) => {
    const key = a.teacherId || "_unknown";
    if (!acc[key]) acc[key] = { teacherId: a.teacherId, teacherName: `${a.teacher?.firstName ?? ""} ${a.teacher?.lastName ?? ""}`.trim() || "—", items: [] };
    acc[key].items.push(a);
    return acc;
  }, {} as Record<string, any>);

  const teacherGroups = Object.values(byTeacher);

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4" />
          Filtrer par
        </div>
        <input
          type="text"
          placeholder="ID enseignant (UUID)"
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[200px]"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[200px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name || c.code}</option>
          ))}
        </select>
        <button
          onClick={loadAssignments}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
        <div className="ml-auto text-sm text-slate-500">
          {assignments.length} affectation(s)
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : teacherGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune affectation trouvée</p>
          <p className="text-xs text-slate-400 mt-1">
            Distribuez du matériel aux enseignants depuis l'onglet Inventaire.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {teacherGroups.map((group: any) => (
            <div key={group.teacherId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="font-bold text-slate-900 text-sm">{group.teacherName}</span>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                  {group.items.length} matériel(s)
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matériel</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Catégorie</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Classe</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Quantité</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">État</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Signé</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">
                        {item.material?.name || "—"}
                        {item.material?.code && (
                          <span className="text-[10px] text-slate-400 ml-1">[{item.material.code}]</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {CATEGORY_LABELS[item.material?.category] || item.material?.category || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {item.class?.name || "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-600">
                        {CONDITION_LABELS[item.conditionAtIssue] || item.conditionAtIssue || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.signed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
