"use client";

/**
 * ============================================================================
 * TEACHER MATERIALS WORKSPACE — Vue enseignant (Espace Pédagogique → Matériel)
 * ============================================================================
 *
 * Flux utilisateur :
 *   1. L'enseignant voit automatiquement TOUT le matériel qui lui a été
 *      distribué (groupé par catégorie : manuels, guides, labo, etc.)
 *   2. En fin d'année, il coche pour chaque item :
 *      - Combien retournés (returnQuantity)
 *      - État au retour (returnCondition)
 *      - Notes éventuelles
 *   3. Il signe une fois (signature pad → base64)
 *   4. Il clique "Envoyer" → toutes ses attributions PENDING passent SUBMITTED
 *   5. La direction les voit dans l'onglet Retour (validation/refus)
 *
 * Backend :
 *   GET   /api/pedagogy/material-returns/my-assignments?userId=&academicYearId=
 *   PATCH /api/pedagogy/material-returns/:id/return
 *   POST  /api/pedagogy/material-returns/submit
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, Package, BookOpen, FlaskConical, FileText,
  Monitor, Send, CheckCircle2, XCircle, AlertCircle, PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useAppSession } from "@/contexts/AppSessionContext";
import { cn } from "@/lib/utils";

const cn2 = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

const CATEGORY_GROUPS = [
  { id: "BOOK", label: "Manuels scolaires", icon: BookOpen, color: "text-indigo-700 bg-indigo-50" },
  { id: "TEACHER_GUIDE", label: "Guides pédagogiques", icon: BookOpen, color: "text-rose-700 bg-rose-50" },
  { id: "OFFICIAL_DOCUMENT", label: "Documents officiels", icon: FileText, color: "text-blue-700 bg-blue-50" },
  { id: "DIDACTIC_SUPPORT", label: "Supports didactiques", icon: Monitor, color: "text-emerald-700 bg-emerald-50" },
  { id: "LAB_MATERIAL", label: "Matériel de laboratoire", icon: FlaskConical, color: "text-amber-700 bg-amber-50" },
  { id: "OTHER", label: "Autre", icon: Package, color: "text-slate-700 bg-slate-50" },
];

const CONDITION_OPTIONS = [
  { value: "NEW", label: "Neuf" },
  { value: "GOOD", label: "Bon état" },
  { value: "USED", label: "Usé" },
  { value: "DAMAGED", label: "Endommagé" },
  { value: "LOST", label: "Perdu" },
];

const RETURN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "À compléter", color: "bg-slate-100 text-slate-700", icon: AlertCircle },
  SUBMITTED: { label: "Soumis à la direction", color: "bg-amber-100 text-amber-700", icon: Send },
  VALIDATED: { label: "Validé par la direction", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Refusé — à corriger", color: "bg-rose-100 text-rose-700", icon: XCircle },
};

interface TeacherMaterialsWorkspaceProps {
  teacherId: string;
  academicYearId: string;
}

export function TeacherMaterialsWorkspace({
  teacherId,
  academicYearId,
}: TeacherMaterialsWorkspaceProps) {
  const { user } = useAppSession();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [hasTeacherProfile, setHasTeacherProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // === Charger mes attributions ===
  const loadMyAssignments = useCallback(async () => {
    if (!teacherId || !academicYearId || !user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy/material-returns/my-assignments?userId=${encodeURIComponent(user.id)}&academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setHasTeacherProfile(data?.hasTeacherProfile !== false);
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
    } catch (e) {
      console.error(e);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, user?.id]);

  useEffect(() => { loadMyAssignments(); }, [loadMyAssignments]);

  // === Mettre à jour une ligne de retour ===
  const updateReturn = async (id: string, field: "returnQuantity" | "returnCondition" | "returnNotes", value: any) => {
    // Optimistic update
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    try {
      const res = await fetch(`/api/pedagogy/material-returns/${id}/return`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
      // Revert optimistic update
      loadMyAssignments();
    }
  };

  // === Soumettre TOUTES mes attributions PENDING avec signature ===
  const handleSubmit = async () => {
    if (!signature) {
      toast.error("Veuillez signer avant d'envoyer");
      return;
    }
    // Vérifier que chaque ligne a returnQuantity renseigné
    const pending = assignments.filter(a => a.returnStatus === "PENDING" || a.returnStatus === "REJECTED");
    if (pending.length === 0) {
      toast.error("Aucune déclaration en attente");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pedagogy/material-returns/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user?.id,
          academicYearId,
          signatureUrl: signature,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      const data = await res.json();
      toast.success(`✅ ${data.submittedCount} déclaration(s) envoyée(s) à la direction`);
      setShowSubmitModal(false);
      setSignature(null);
      loadMyAssignments();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // === Grouper par catégorie ===
  const byCategory = assignments.reduce((acc, a) => {
    const cat = a.materialCategory || "OTHER";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, any[]>);

  // === Stats globales ===
  const totalItems = assignments.length;
  const totalQty = assignments.reduce((sum, a) => sum + (a.quantity ?? 0), 0);
  const pendingCount = assignments.filter(a => a.returnStatus === "PENDING" || a.returnStatus === "REJECTED").length;
  const submittedCount = assignments.filter(a => a.returnStatus === "SUBMITTED").length;
  const validatedCount = assignments.filter(a => a.returnStatus === "VALIDATED").length;

  if (!hasTeacherProfile && !loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucun profil enseignant lié à votre compte</p>
        <p className="text-xs text-slate-400 mt-1">
          Contactez la direction pour vérifier votre profil Teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* === En-tête + stats === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Mon matériel pédagogique</div>
              <div className="text-xs text-slate-500">
                {totalItems} type(s) · {totalQty} unité(s) au total
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMyAssignments}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {pendingCount > 0 && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
            >
              <Send className="h-4 w-4" />
              Déclarer mes retours ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* === Stats rapides === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 uppercase font-bold">À compléter</div>
          <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-amber-200">
          <div className="text-xs text-amber-700 uppercase font-bold">Soumis</div>
          <div className="text-2xl font-bold text-amber-700">{submittedCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-emerald-200">
          <div className="text-xs text-emerald-700 uppercase font-bold">Validés</div>
          <div className="text-2xl font-bold text-emerald-700">{validatedCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 uppercase font-bold">Total</div>
          <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
        </div>
      </div>

      {/* === Contenu === */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun matériel ne vous a encore été distribué</p>
          <p className="text-xs text-slate-400 mt-1">
            La direction vous affectera du matériel pédagogique en début d'année.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_GROUPS.map((group) => {
            const items = byCategory[group.id] || [];
            if (items.length === 0) return null;
            const Icon = group.icon;
            return (
              <div key={group.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* En-tête catégorie */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn2("p-1.5 rounded-lg", group.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm">{group.label}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full">
                    {items.length} type(s)
                  </span>
                </div>
                {/* Items */}
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Matériel</th>
                      <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Classe</th>
                      <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Qté reçue</th>
                      <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Qté retournée</th>
                      <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">État</th>
                      <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">Notes</th>
                      <th className="text-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any) => {
                      const status = item.returnStatus || "PENDING";
                      const statusCfg = RETURN_STATUS_CONFIG[status] || RETURN_STATUS_CONFIG.PENDING;
                      const StatusIcon = statusCfg.icon;
                      const isLocked = status === "SUBMITTED" || status === "VALIDATED";
                      const isRejected = status === "REJECTED";
                      return (
                        <tr key={item.id} className={cn2("border-b border-slate-100", isRejected && "bg-rose-50/30")}>
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">
                            {item.materialName || "—"}
                            {item.materialCode && (
                              <span className="text-[10px] text-slate-400 ml-1">[{item.materialCode}]</span>
                            )}
                            {item.materialDescription && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{item.materialDescription}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{item.className || "—"}</td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">{item.quantity}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={item.returnQuantity ?? 0}
                              onChange={(e) => {
                                const val = Math.min(parseInt(e.target.value) || 0, item.quantity);
                                updateReturn(item.id, "returnQuantity", val);
                              }}
                              disabled={isLocked}
                              className={cn2(
                                "w-16 px-2 py-1 border border-slate-200 rounded text-center text-sm font-bold",
                                isLocked ? "bg-slate-100 text-slate-400" : "bg-white text-emerald-700",
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={item.returnCondition || ""}
                              onChange={(e) => updateReturn(item.id, "returnCondition", e.target.value)}
                              disabled={isLocked}
                              className={cn2(
                                "px-2 py-1 border border-slate-200 rounded text-xs",
                                isLocked && "bg-slate-100 text-slate-400",
                              )}
                            >
                              <option value="">—</option>
                              {CONDITION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <input
                              type="text"
                              value={item.returnNotes || ""}
                              onChange={(e) => updateReturn(item.id, "returnNotes", e.target.value)}
                              disabled={isLocked}
                              placeholder="Notes..."
                              className={cn2(
                                "w-full px-2 py-1 border border-slate-200 rounded text-xs",
                                isLocked && "bg-slate-100 text-slate-400",
                              )}
                            />
                            {isRejected && item.returnRejectionReason && (
                              <div className="mt-1 text-[10px] text-rose-600 font-semibold">
                                Refusé : {item.returnRejectionReason}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn2("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", statusCfg.color)}>
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
            );
          })}

          {/* === Bouton d'envoi en bas === */}
          {pendingCount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-900">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-bold">{pendingCount} déclaration(s) en attente</div>
                  <div className="text-xs text-blue-700">
                    Vérifiez vos quantités retournées, signez puis cliquez "Envoyer".
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                <Send className="h-4 w-4" />
                Signer et envoyer
              </button>
            </div>
          )}
        </div>
      )}

      {/* === MODAL : Signature + envoi === */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PenTool className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Signature et envoi</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      En signant, vous confirmez avoir retourné les quantités déclarées.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowSubmitModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Récapitulatif */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-bold text-slate-600 uppercase mb-2">Récapitulatif</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Déclarations</div>
                    <div className="font-bold text-slate-900">{pendingCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Total reçu</div>
                    <div className="font-bold text-slate-900">
                      {assignments.filter(a => a.returnStatus === "PENDING" || a.returnStatus === "REJECTED")
                        .reduce((s, a) => s + a.quantity, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Total retourné</div>
                    <div className="font-bold text-emerald-700">
                      {assignments.filter(a => a.returnStatus === "PENDING" || a.returnStatus === "REJECTED")
                        .reduce((s, a) => s + (a.returnQuantity ?? 0), 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature pad */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                  Ma signature *
                </label>
                <SignatureCanvas
                  width={500}
                  height={180}
                  placeholder="Signez ici avec votre souris ou doigt"
                  onSignatureChange={(data) => setSignature(data)}
                />
                {!signature && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Votre signature sera jointe à chaque déclaration envoyée.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setShowSubmitModal(false)} disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !signature}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer à la direction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
