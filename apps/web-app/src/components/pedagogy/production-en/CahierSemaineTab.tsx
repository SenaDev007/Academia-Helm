"use client";

/**
 * ============================================================================
 * CAHIER DU SEMAINIER — Suivi quotidien & hebdomadaire de l'établissement
 * ============================================================================
 *
 * 3 sous-onglets :
 *   1. Paramétrage (PROMOTER + DIRECTOR uniquement)
 *      - Bouton "Générer automatiquement" (rotation 36 semaines)
 *      - Bouton "Configuration manuelle" (créer 1 semainier à la fois)
 *      - Bouton suppression (si PENDING)
 *   2. Liste des semainiers (tous — signature enseignant)
 *   3. Cahier du Semainier (rapport quotidien + rapport de fin de semaine)
 *      - 5 jours (Lun-Ven) avec dates précises : "Lundi 23/07/2026"
 *      - 6e "jour" virtuel : Rapport de fin de semaine (page 8 du document)
 *
 * Conforme au PDF "Cahier du Semainier" (222 pages, 36 semaines × 6 pages).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Settings, List, FileText, Loader2, Save, RefreshCw,
  Plus, Trash2, CheckCircle2, Check, X, Zap, Hand, ChevronRight, Send,
  ClipboardList, Users, BookOpen, Shield, Sparkles, CalendarRange,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppSession } from "@/contexts/AppSessionContext";
import { SemainierAttendancePanel } from "@/components/hr/SemainierAttendancePanel";

interface CahierSemaineTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");
const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                     "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// ⭐ Helper : formate une date comme "Lundi 23/07/2026"
function formatDayWithDate(dayOfWeek: number, weekStartDate: string | Date): string {
  const base = new Date(weekStartDate);
  base.setDate(base.getDate() + (dayOfWeek - 1));
  const dayName = DAY_NAMES[dayOfWeek];
  const dateStr = base.toLocaleDateString('fr-FR');
  return `${dayName} ${dateStr}`;
}

// ⭐ Helper : format court "23/07/2026"
function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR');
}

export function CahierSemaineTab({ tenantId, academicYearId, teacherId }: CahierSemaineTabProps) {
  const { user } = useAppSession();
  const [activeSubTab, setActiveSubTab] = useState<"config" | "list" | "cahier">("config");
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // ⭐ Modal de confirmation professionnel pour la génération auto (remplace confirm())
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  // ⭐ Modal de signature (pour le tableau Paramétrage + Liste)
  const [signModal, setSignModal] = useState<{ open: boolean; configId: string; teacherId: string; teacherName: string }>({ open: false, configId: '', teacherId: '', teacherName: '' });

  // ⭐ Permissions : Paramétrage visible uniquement pour PROMOTER + DIRECTOR
  const canConfigure = ['PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
    'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR',
    'admin', 'director'].includes(user?.role || '');

  // === Chargement des données ===
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const configRes = await fetch(`/api/pedagogy-space/seminar-config?academicYearId=${academicYearId}`, { credentials: "include" });
      const configData = await configRes.json();
      setConfigs(Array.isArray(configData) ? configData : []);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => { loadData(); }, [loadData]);

  // === Génération automatique (avec modal professionnel) ===
  const handleAutoGenerate = async () => {
    setShowAutoGenModal(false);
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/seminar-config/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academicYearId, tenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur de génération");
      }
      const result = await res.json();
      toast.success(`✅ ${result.generated} semainiers générés`, {
        description: `${result.teachersCount} enseignant(s) FR éligible(s) — voir détails`,
      });
      loadData();
    } catch (e: any) {
      toast.error("Erreur de génération automatique", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Configuration manuelle (créer 1 semainier) ===
  const handleManualCreate = async (data: {
    weekNumber: number;
    trimester: number;
    weekStartDate: string;
    weekEndDate: string;
    teacherId: string;
    classIds: string[];
  }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/seminar-config/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, academicYearId, tenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success(`✅ Semainier S${data.weekNumber} créé manuellement`);
      loadData();
      return true;
    } catch (e: any) {
      toast.error("Erreur de création manuelle", { description: e.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // === Suppression manuelle (avec modal) ===
  const handleDeleteConfig = async (configId: string, weekNumber: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-config/${configId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success(`🗑️ Semainier S${weekNumber} supprimé`);
      loadData();
    } catch (e: any) {
      toast.error("Erreur de suppression", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Mise à jour d'un semainier ===
  const handleUpdateConfig = async (configId: string, data: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-config/${configId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Semainier mis à jour");
      loadData();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ⭐ État pour stocker la signature en cours de dessin (avant confirmation)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  // === Signature enseignant avec propagation automatique ===
  // ⭐ Quand l'enseignant signe, sa signature est propagée à TOUTES
  //    les autres lignes où il est désigné comme semainier.
  //    Appelée UNIQUEMENT quand l'utilisateur clique "Confirmer" (pas auto)
  const handleSignWithPropagation = async () => {
    if (!pendingSignature || !signModal.teacherId) return;
    setSaving(true);
    try {
      const teacherConfigs = configs.filter(c => c.teacherId === signModal.teacherId);
      await Promise.all(teacherConfigs.map(async (cfg) => {
        await fetch(`/api/pedagogy-space/seminar-config/${cfg.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ teacherSignature: pendingSignature, status: "SIGNED" }),
        });
      }));
      toast.success("✅ Signature enregistrée", {
        description: `Propagée à ${teacherConfigs.length} semaine(s) où vous êtes désigné.`,
      });
      setSignModal({ open: false, configId: '', teacherId: '', teacherName: '' });
      setPendingSignature(null);
      loadData();
    } catch (e: any) {
      toast.error("Erreur lors de la signature", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ Supprimer la signature d'un enseignant
  const handleDeleteSignature = async (teacherId: string) => {
    if (!confirm('Supprimer la signature de cet enseignant ?')) return;
    setSaving(true);
    try {
      const teacherConfigs = configs.filter(c => c.teacherId === teacherId);
      await Promise.all(teacherConfigs.map(async (cfg) => {
        await fetch(`/api/pedagogy-space/seminar-config/${cfg.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ teacherSignature: null, status: "PENDING" }),
        });
      }));
      toast.success('🗑️ Signature supprimée', {
        description: `Retirée de ${teacherConfigs.length} semaine(s).`,
      });
      loadData();
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* === Sous-onglets === */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
        {canConfigure && (
          <button onClick={() => setActiveSubTab("config")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
              activeSubTab === "config" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
            <Settings className="h-4 w-4" /> Paramétrage
          </button>
        )}
        <button onClick={() => setActiveSubTab("list")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeSubTab === "list" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <List className="h-4 w-4" /> Liste des semainiers
        </button>
        <button onClick={() => setActiveSubTab("cahier")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeSubTab === "cahier" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <FileText className="h-4 w-4" /> Cahier du Semainier
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {/* === SOUS-ONGLET 1: PARAMÉTRAGE === */}
      {activeSubTab === "config" && canConfigure && !loading && (
        <ParametrageTab
          configs={configs}
          saving={saving}
          onAutoGenerate={() => setShowAutoGenModal(true)}
          onManualCreate={handleManualCreate}
          onDelete={handleDeleteConfig}
          onUpdate={handleUpdateConfig}
          onReload={loadData}
          academicYearId={academicYearId}
          tenantId={tenantId}
          onSign={(teacherId: string, teacherName: string) => setSignModal({ open: true, configId: '', teacherId, teacherName })}
        />
      )}

      {/* === SOUS-ONGLET 2: LISTE DES SEMAINIERS === */}
      {activeSubTab === "list" && !loading && (
        <ListeSemainiersTab
          configs={configs}
          currentUserId={user?.id || ""}
          onSign={(configId: string, signature: string | null) => {
            const cfg = configs.find(c => c.id === configId);
            if (cfg) {
              setSignModal({ open: true, configId, teacherId: cfg.teacherId, teacherName: cfg.teacherName || '' });
            }
          }}
          onDeleteSignature={handleDeleteSignature}
        />
      )}

      {/* === SOUS-ONGLET 3: CAHIER DU SEMAINIER === */}
      {activeSubTab === "cahier" && !loading && (
        <CahierSemainierContent
          configs={configs}
          currentUserId={user?.id || ""}
          academicYearId={academicYearId}
          tenantId={tenantId}
          onRefresh={loadData}
        />
      )}

      {/* ⭐ MODAL: Confirmation génération automatique (professionnel, remplace confirm()) */}
      {showAutoGenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-amber-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Zap className="h-10 w-10 text-amber-500" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Génération automatique des semainiers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Action de configuration direction</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 font-medium">
                Vous êtes sur le point de générer automatiquement 36 semaines de semainiers.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Conséquences :</p>
                <div className="flex items-start gap-1.5 text-xs text-slate-700"><ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" /><span>Tous les semainiers existants seront supprimés</span></div>
                <div className="flex items-start gap-1.5 text-xs text-slate-700"><ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" /><span>36 nouveaux semainiers seront créés par rotation des enseignants FR</span></div>
                <div className="flex items-start gap-1.5 text-xs text-slate-700"><ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" /><span>Seuls les enseignants FR (maternelle + primaire) sont éligibles</span></div>
                <div className="flex items-start gap-1.5 text-xs text-slate-700"><ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" /><span>Les classes assignées à chaque enseignant seront récupérées automatiquement</span></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setShowAutoGenModal(false)} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">Annuler</button>
              <button onClick={handleAutoGenerate} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Générer les 36 semainiers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ MODAL: Signature enseignant (avec propagation à toutes les lignes) */}
      {signModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Signature du Semainier</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{signModal.teacherName}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>ℹ️ Propagation automatique :</strong> Votre signature sera appliquée à
                toutes les semaines où vous êtes désigné comme semainier ({configs.filter(c => c.teacherId === signModal.teacherId).length} semaine(s)).
                Vous n'avez pas besoin de signer chaque ligne individuellement.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Votre signature</label>
                {/* ⭐ SignatureCanvas stocke dans pendingSignature (ne soumet PAS automatiquement) */}
                <SignatureCanvas
                  width={360}
                  height={140}
                  placeholder="Signez ici..."
                  onSignatureChange={(data: string | null) => setPendingSignature(data)}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => { setSignModal({ open: false, configId: '', teacherId: '', teacherName: '' }); setPendingSignature(null); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                Annuler
              </button>
              {/* ⭐ Bouton Confirmer — soumet la signature SEULEMENT quand l'utilisateur clique */}
              <button onClick={handleSignWithPropagation}
                disabled={saving || !pendingSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmer la signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 1: PARAMÉTRAGE
// ============================================================================
function ParametrageTab({ configs, saving, onAutoGenerate, onManualCreate, onDelete, onUpdate, onReload, academicYearId, tenantId, onSign }: any) {
  const [showManualModal, setShowManualModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Paramétrage des semainiers de l'année</h3>
          <p className="text-xs text-slate-500">{configs.length} semaine(s) configurée(s)</p>
        </div>
        <div className="flex-1" />
        <button onClick={onReload} className="p-2 hover:bg-slate-200 rounded-lg" title="Recharger">
          <RefreshCw className="h-4 w-4" />
        </button>
        {/* ⭐ Bouton Configuration manuelle */}
        <button onClick={() => setShowManualModal(true)} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
          Configuration manuelle
        </button>
        {/* ⭐ Bouton Générer automatiquement — ouvre le modal professionnel via onAutoGenerate */}
        <button onClick={onAutoGenerate} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Générer automatiquement
        </button>
      </div>

      {/* Info aide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <p className="font-bold mb-1">💡 Deux modes de paramétrage :</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Générer automatiquement</strong> : crée 36 semaines par rotation des enseignants FR (maternelle + primaire).</li>
          <li><strong>Configuration manuelle</strong> : crée une semaine à la fois en choisissant l'enseignant et les classes.</li>
        </ul>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucun semainier configuré</p>
          <p className="text-sm text-slate-500 mt-1">
            Utilisez "Générer automatiquement" pour créer 36 semaines par rotation, ou
            "Configuration manuelle" pour créer une semaine à la fois.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-bold text-slate-700">Semaine</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Trimestre</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Dates</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Enseignant désigné</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Classe(s)</th>
                <th className="text-center px-4 py-3 font-bold text-slate-700">Signature</th>
                <th className="text-center px-4 py-3 font-bold text-slate-700">Statut</th>
                <th className="text-center px-4 py-3 font-bold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg: any) => (
                <tr key={cfg.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">S{cfg.weekNumber}</td>
                  <td className="px-4 py-2.5">T{cfg.trimester}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {formatDateShort(cfg.weekStartDate)} → {formatDateShort(cfg.weekEndDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="text" value={cfg.teacherName || ''} disabled
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {cfg.classNames?.join(', ') || cfg.classIds?.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {cfg.teacherSignature ? (
                      <img src={cfg.teacherSignature} alt="Signature" className="h-8 mx-auto cursor-pointer" onClick={() => onSign?.(cfg.teacherId, cfg.teacherName)} />
                    ) : (
                      <button onClick={() => onSign?.(cfg.teacherId, cfg.teacherName)}
                        className="text-blue-600 text-xs hover:underline cursor-pointer">
                        Signer
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold",
                      cfg.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {cfg.status === 'SIGNED' ? 'Signé' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {cfg.status !== 'SIGNED' && cfg.status !== 'VALIDATED' && (
                      <button onClick={() => onDelete(cfg.id, cfg.weekNumber)} title="Supprimer"
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Configuration manuelle */}
      {showManualModal && (
        <ManualConfigModal
          onClose={() => setShowManualModal(false)}
          onCreate={async (data) => {
            const ok = await onManualCreate(data);
            if (ok) setShowManualModal(false);
          }}
          existingWeeks={configs.map((c: any) => c.weekNumber)}
          academicYearId={academicYearId}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL: Configuration manuelle d'un semainier
// ============================================================================
function ManualConfigModal({ onClose, onCreate, existingWeeks, academicYearId, tenantId }: any) {
  const [eligibleTeachers, setEligibleTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    weekNumber: 1,
    trimester: 1,
    weekStartDate: '',
    weekEndDate: '',
    teacherId: '',
    classIds: [] as string[],
  });

  // Charger les enseignants éligibles + leurs classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/seminar-config/eligible-teachers?academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        setEligibleTeachers(Array.isArray(data) ? data : []);
      } catch (e) {
        toast.error("Impossible de charger les enseignants éligibles");
      } finally {
        setLoading(false);
      }
    })();
  }, [academicYearId]);

  // Auto-calcul du trimestre à partir du numéro de semaine
  useEffect(() => {
    let trim = 1;
    if (form.weekNumber > 12 && form.weekNumber <= 24) trim = 2;
    else if (form.weekNumber > 24) trim = 3;
    setForm(f => ({ ...f, trimester: trim }));
  }, [form.weekNumber]);

  // Auto-calcul des dates (lundi → vendredi) à partir du numéro de semaine
  // On suppose que la semaine 1 commence au 1er septembre (ajusté au lundi)
  useEffect(() => {
    const baseYear = new Date().getFullYear();
    const start = new Date(baseYear, 8, 1); // 1er septembre
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);

    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + (form.weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);

    setForm(f => ({
      ...f,
      weekStartDate: weekStart.toISOString().split('T')[0],
      weekEndDate: weekEnd.toISOString().split('T')[0],
    }));
  }, [form.weekNumber]);

  const selectedTeacher = eligibleTeachers.find(t => t.id === form.teacherId);

  const handleSubmit = () => {
    if (!form.teacherId) {
      toast.error("Veuillez sélectionner un enseignant");
      return;
    }
    if (existingWeeks.includes(form.weekNumber)) {
      toast.error(`La semaine S${form.weekNumber} existe déjà. Supprimez-la d'abord.`);
      return;
    }
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Hand className="h-5 w-5 text-blue-600" /> Configuration manuelle du semainier
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : eligibleTeachers.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              <p className="font-bold mb-1">⚠️ Aucun enseignant éligible</p>
              <p>Aucun enseignant actif sur la piste FR (maternelle + primaire) n'a été trouvé.
              Vérifiez que les enseignants ont <code>assignedLanguages=["FR"]</code> dans leur profil.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Numéro de semaine (1-36)</label>
                  <input type="number" min={1} max={36} value={form.weekNumber}
                    onChange={e => setForm({ ...form, weekNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Trimestre (auto)</label>
                  <input type="text" value={`T${form.trimester}`} disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Date début (lundi)</label>
                  <input type="date" value={form.weekStartDate}
                    onChange={e => setForm({ ...form, weekStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Date fin (vendredi)</label>
                  <input type="date" value={form.weekEndDate}
                    onChange={e => setForm({ ...form, weekEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Enseignant désigné ({eligibleTeachers.length} éligible(s) FR)
                </label>
                <select value={form.teacherId}
                  onChange={e => setForm({ ...form, teacherId: e.target.value, classIds: [] })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">— Sélectionner —</option>
                  {eligibleTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.matricule || '—'}) — {t.schoolLevelCode} — {t.classesCount} classe(s)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeacher && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Classe(s) à rattacher au semainier
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {selectedTeacher.classes.length === 0 ? (
                      <p className="col-span-2 text-xs text-slate-500 italic">
                        Aucune classe assignée à cet enseignant.
                      </p>
                    ) : (
                      selectedTeacher.classes.map((c: any) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={form.classIds.includes(c.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setForm({ ...form, classIds: [...form.classIds, c.id] });
                              } else {
                                setForm({ ...form, classIds: form.classIds.filter((id: string) => id !== c.id) });
                              }
                            }} />
                          <span>{c.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <p className="font-bold">Récapitulatif :</p>
                <p>Semaine <strong>S{form.weekNumber}</strong> | Trimestre <strong>T{form.trimester}</strong></p>
                <p>Du <strong>{formatDateShort(form.weekStartDate)}</strong> au <strong>{formatDateShort(form.weekEndDate)}</strong></p>
                <p>Enseignant : <strong>{selectedTeacher?.name || '—'}</strong></p>
                <p>Classes : <strong>{form.classIds.length}</strong> sélectionnée(s)</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-semibold">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading || eligibleTeachers.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            Créer le semainier
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 2: LISTE DES SEMAINIERS (avec signature enseignant)
// ============================================================================
function ListeSemainiersTab({ configs, currentUserId, onSign, onDeleteSignature }: any) {
  // ⭐ Sécurité anti-impersonnation : résoudre le teacherId lié à l'utilisateur connecté
  //    Le frontend appelle GET /seminar-config/my-teacher-id?userId=X au montage.
  //    Le backend retourne { teacherId, userRole }.
  //    - Si userRole est un rôle direction (PROMOTER, DIRECTEUR_*, admin...),
  //      l'utilisateur peut signer TOUTES les lignes (à la place de n'importe quel enseignant).
  //    - Sinon (rôle teacher), seul la ligne où cfg.teacherId === currentTeacherId est éditable.
  //    Les autres lignes sont grisées (disabled).
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  // ⭐ Rôles direction qui peuvent signer à la place de n'importe quel enseignant
  //    (gestion des remplacements, signatures par défaut, etc.)
  const DIRECTOR_ROLES = new Set([
    'PROMOTER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
    'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
    'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTOR', 'DIRECTEUR',
    'admin', 'director',
  ]);
  const canSignAnyLine = currentUserRole ? DIRECTOR_ROLES.has(currentUserRole.toUpperCase()) : false;

  useEffect(() => {
    if (!currentUserId) {
      setLoadingIdentity(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/seminar-config/my-teacher-id?userId=${currentUserId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCurrentTeacherId(data.teacherId || null);
          setCurrentUserRole(data.userRole || null);
        }
      } catch {
        // Erreur silencieuse — la sécurité reste active (aucune ligne éditable)
      } finally {
        setLoadingIdentity(false);
      }
    })();
  }, [currentUserId]);

  // ⭐ Vérifier si une ligne correspond à l'enseignant connecté
  //    - Si canSignAnyLine = true (rôle direction), toutes les lignes sont éditables
  //    - Sinon, seule la ligne où cfg.teacherId === currentTeacherId est éditable
  const isLineEditable = (cfg: any): boolean => {
    if (canSignAnyLine) return true;
    if (!currentTeacherId) return false;
    return cfg.teacherId === currentTeacherId;
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Liste des semainiers de l'année.</strong> Cliquez sur "Signer" pour signer.
          Votre signature sera propagée automatiquement à toutes les semaines où vous êtes désigné.
        </p>
        {/* ⭐ Message de sécurité : seul l'enseignant connecté peut signer sa ligne */}
        {!loadingIdentity && !canSignAnyLine && (
          <p className="text-[11px] text-blue-700 mt-1.5 italic">
            🔒 Pour des raisons de sécurité, seule la ligne où vous êtes désigné comme semainier est éditable.
            Les autres lignes sont en lecture seule.
          </p>
        )}
        {canSignAnyLine && (
          <p className="text-[11px] text-purple-700 mt-1.5 italic">
            👤 Vous êtes connecté en tant que <strong>direction</strong> ({currentUserRole}) — vous pouvez signer à la place de n'importe quel enseignant.
          </p>
        )}
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <List className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucun semainier configuré</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-bold text-slate-700">Semaine</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Trimestre</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Dates</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Semainier</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Classe(s)</th>
                <th className="text-center px-4 py-3 font-bold text-slate-700 min-w-[200px]">Signature</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg: any) => {
                // ⭐ Vérifier si CETTE ligne est éditable par l'utilisateur connecté
                const editable = isLineEditable(cfg);
                // ⭐ Surligner la ligne de l'utilisateur connecté (pour qu'il la repère)
                const isMyLine = currentTeacherId && cfg.teacherId === currentTeacherId;
                return (
                  <tr key={cfg.id} className={cn(
                    "border-b border-slate-100",
                    isMyLine && "bg-emerald-50/40",  // ⭐ Ligne de l'utilisateur connecté = fond emerald clair
                    !editable && !cfg.teacherSignature && "opacity-50",  // ⭐ Lignes non éditables = grisées
                  )}>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      S{cfg.weekNumber}
                      {isMyLine && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          ★ Vous
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">T{cfg.trimester}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatDateShort(cfg.weekStartDate)} → {formatDateShort(cfg.weekEndDate)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{cfg.teacherName || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {cfg.classNames?.join(', ') || cfg.classIds?.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {cfg.teacherSignature ? (
                        <div className="flex items-center gap-2">
                          <img src={cfg.teacherSignature} alt="Signature" className="h-10" />
                          {/* ⭐ Bouton supprimer signature : seulement si la ligne est éditable */}
                          {editable && (
                            <button
                              onClick={() => onDeleteSignature?.(cfg.teacherId)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Supprimer la signature"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : cfg.teacherId ? (
                        editable ? (
                          <button
                            onClick={() => onSign(cfg.id, null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Signer
                          </button>
                        ) : (
                          // ⭐ Ligne non éditable : bouton Signer désactivé (grisé)
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed"
                            title="Vous n'êtes pas désigné comme semainier pour cette semaine — signature non autorisée"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Non autorisé
                          </button>
                        )
                      ) : (
                        <span className="text-slate-300 text-xs">Aucun enseignant</span>
                      )}
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
// SOUS-ONGLET 3: CAHIER DU SEMAINIER (rapport quotidien + rapport de fin de semaine)
// ============================================================================
function CahierSemainierContent({ configs, currentUserId, academicYearId, tenantId, onRefresh }: any) {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  // ⭐ selectedDay : 1-5 = Lun-Ven, 6 = Rapport de fin de semaine
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // ⭐ Modal personnalisé professionnel pour l'envoi au directeur (remplace confirm())
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentConfig = configs.find((c: any) => c.weekNumber === selectedWeek);

  // Charger le rapport du jour OU le rapport hebdo
  useEffect(() => {
    if (!currentConfig) return;
    setLoading(true);
    (async () => {
      try {
        if (selectedDay === 6) {
          // Rapport hebdo (fin de semaine)
          const res = await fetch(`/api/pedagogy-space/seminar-weekly-report?configId=${currentConfig.id}`, { credentials: "include" });
          const data = await res.json();
          setWeeklyReport(data?.id ? data : null);
        } else {
          // Rapport journalier
          const res = await fetch(`/api/pedagogy-space/seminar-daily-report?configId=${currentConfig.id}&dayOfWeek=${selectedDay}`, { credentials: "include" });
          const data = await res.json();
          setDailyReport(data?.id ? data : null);
        }
      } catch {
        if (selectedDay === 6) setWeeklyReport(null);
        else setDailyReport(null);
      }
      finally { setLoading(false); }
    })();
  }, [currentConfig?.id, selectedDay]);

  const handleSaveDaily = async () => {
    if (!dailyReport) return;
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-daily-report/${dailyReport.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dailyReport),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Rapport quotidien enregistré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleSaveWeekly = async () => {
    if (!weeklyReport) return;
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-weekly-report/${weeklyReport.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(weeklyReport),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Rapport de fin de semaine enregistré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ⭐ 6 "jours" : 1-5 = Lun-Ven, 6 = Rapport de fin de semaine
  const DAYS = [
    { num: 1, label: "Lundi" }, { num: 2, label: "Mardi" },
    { num: 3, label: "Mercredi" }, { num: 4, label: "Jeudi" },
    { num: 5, label: "Vendredi" },
    { num: 6, label: "Rapport hebdo", isWeekly: true },
  ];

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      {/* Sélecteur de semaine + jour */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Semaine</label>
          <select value={selectedWeek} onChange={e => setSelectedWeek(parseInt(e.target.value))} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
            {configs.map((c: any) => (
              <option key={c.id} value={c.weekNumber}>S{c.weekNumber} — T{c.trimester} ({formatDateShort(c.weekStartDate)})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Jour / Synthèse</label>
          <div className="flex gap-1 flex-wrap">
            {DAYS.map(d => (
              <button key={d.num} onClick={() => setSelectedDay(d.num)}
                className={cn("px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5",
                  selectedDay === d.num
                    ? (d.isWeekly ? "bg-purple-600 text-white" : "bg-blue-600 text-white")
                    : d.isWeekly
                      ? "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}>
                {d.isWeekly ? <CalendarRange className="h-3.5 w-3.5" /> : null}
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {selectedDay === 6 ? (
          <button onClick={handleSaveWeekly} disabled={!weeklyReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> Enregistrer le rapport hebdo
          </button>
        ) : (
          <button onClick={handleSaveDaily} disabled={!dailyReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
        )}
        {/* ⭐ Bouton "Générer PDF" — exporte le rapport complet de la semaine
            (5 rapports journaliers + rapport hebdo) avec en-tête école + footer.
            Backend: GET /api/pedagogy-space/seminar-config/:id/export?format=pdf
            (Puppeteer génère un PDF professionnel identique à l'interface) */}
        {currentConfig && (
          <button
            onClick={async () => {
              try {
                toast.success('⏳ Génération du PDF en cours...', {
                  description: 'Le rapport complet de la semaine sera téléchargé dans quelques secondes.',
                });
                const url = `/api/pedagogy-space/seminar-config/${currentConfig.id}/export?format=pdf`;
                // ⭐ Ouvrir dans un nouvel onglet pour déclencher le download
                window.open(url, '_blank');
              } catch (e: any) {
                toast.error('Erreur de génération PDF', { description: e.message });
              }
            }}
            disabled={!currentConfig}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            title="Génère un PDF complet (Lundi → Vendredi + rapport hebdo) avec en-tête école, signatures et footer"
          >
            <FileText className="h-4 w-4" /> Générer PDF
          </button>
        )}
      </div>

      {/* ⭐ Affichage du rapport journalier (1-5) ou du rapport hebdo (6) */}
      {currentConfig && selectedDay >= 1 && selectedDay <= 5 && (
        <DailyReportCard
          config={currentConfig}
          selectedDay={selectedDay}
          dailyReport={dailyReport}
          setDailyReport={setDailyReport}
        />
      )}

      {currentConfig && selectedDay === 6 && (
        <WeeklyReportCard
          config={currentConfig}
          weeklyReport={weeklyReport}
          setWeeklyReport={setWeeklyReport}
        />
      )}

      {/* ⭐ Bouton "Envoyer au directeur" — ouvre un modal personnalisé (pas de confirm() natif) */}
      {currentConfig && (
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={!currentConfig.teacherSignature || currentConfig.status === 'SUBMITTED' || currentConfig.status === 'VALIDATED'}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!currentConfig.teacherSignature ? 'Vous devez signer d\'abord (Liste des semainiers)' : currentConfig.status === 'SUBMITTED' ? 'Déjà envoyé au directeur' : 'Envoyer tous les rapports au directeur'}
          >
            <Send className="h-4 w-4" />
            {currentConfig.status === 'SUBMITTED' ? 'Envoyé au directeur' : currentConfig.status === 'VALIDATED' ? 'Validé par le directeur' : 'Envoyer au directeur'}
          </button>
        </div>
      )}

      {/* ⭐ MODAL PERSONNALISÉ : Confirmation envoi au directeur (remplace confirm() natif)
          Pattern identique au modal de génération auto — en-tête coloré indigo,
          body avec conséquences, footer avec boutons Annuler / Confirmer. */}
      {showSubmitModal && currentConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* En-tête coloré */}
            <div className="px-6 py-4 border-b bg-indigo-50 border-indigo-200">
              <div className="flex items-center gap-3">
                <Send className="h-10 w-10 text-indigo-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Envoyer au directeur</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Semaine S{currentConfig.weekNumber} · Trimestre {currentConfig.trimester}
                  </p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 font-medium">
                Vous êtes sur le point d'envoyer tous les rapports de cette semaine au directeur pour validation.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Ce qui sera envoyé :</p>
                <div className="flex items-start gap-1.5 text-xs text-slate-700">
                  <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>5 rapports journaliers (Lundi → Vendredi)</span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-slate-700">
                  <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>1 rapport de fin de semaine (synthèse hebdomadaire)</span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-slate-700">
                  <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>Votre signature d'enseignant semainier</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase">⚠ Conséquences :</p>
                <p className="text-xs text-amber-900">
                  Après envoi, vous ne pourrez plus modifier les rapports de cette semaine.
                  Le directeur les validera ou les rejettera via son espace Validation Direction.
                </p>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch(`/api/pedagogy-space/seminar-config/${currentConfig.id}/submit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err.message || 'Erreur');
                    }
                    toast.success('📧 Rapports envoyés au directeur', {
                      description: 'Le directeur recevra les rapports de cette semaine pour validation.',
                    });
                    setShowSubmitModal(false);
                    onRefresh?.();
                  } catch (e: any) {
                    toast.error('Erreur lors de l\'envoi', { description: e.message });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Confirmer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CARTE: RAPPORT JOURNALIER (avec date précise "Lundi 23/07/2026")
// ============================================================================
export function DailyReportCard({ config, selectedDay, dailyReport, setDailyReport }: any) {
  const dayLabel = formatDayWithDate(selectedDay, config.weekStartDate);

  // ⭐ Calculer la date précise du jour sélectionné (YYYY-MM-DD)
  const dayDate = (() => {
    const base = new Date(config.weekStartDate);
    base.setDate(base.getDate() + (selectedDay - 1));
    return base.toISOString().split('T')[0];
  })();

  return (
    <div className="bg-white rounded-xl border-2 border-slate-800 p-4">
      {/* En-tête avec DATE PRÉCISE */}
      <div className="text-center border-b border-slate-300 pb-2 mb-4">
        <h2 className="text-lg font-bold text-slate-900">CAHIER DU SEMAINIER</h2>
        <p className="text-sm text-slate-600">
          Semaine {config.weekNumber} | Trimestre {config.trimester} | {dayLabel}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Période : {formatDateShort(config.weekStartDate)} → {formatDateShort(config.weekEndDate)}
        </p>
      </div>

      {/* ⭐ Panneau de pointage des enseignants par le semainier
          Connecté au rapport quotidien JSON (teacherAttendance) au lieu de l'API HR */}
      <div className="mb-6">
        <SemainierAttendancePanel
          date={dayDate}
          onMark={(teacherId: string, teacherName: string, status: string, motif?: string) => {
            // ⭐ Mettre à jour le teacherAttendance du rapport quotidien
            const current = dailyReport?.teacherAttendance || [];
            const existing = current.find((t: any) => t.teacherId === teacherId);
            // ⭐ Observation par défaut selon le statut :
            //    - LATE → "En retard"
            //    - MISSION → "En mission"
            //    - HALF_DAY → "Demi-journée"
            //    - ABSENT → "" (motif déjà rempli dans la colonne motif)
            //    - PRESENT → ""
            const defaultObservation = status === 'LATE' ? 'En retard'
              : status === 'MISSION' ? 'En mission'
              : status === 'HALF_DAY' ? 'Demi-journée'
              : '';
            if (existing) {
              // Mettre à jour la ligne existante
              const updated = current.map((t: any) =>
                t.teacherId === teacherId
                  ? {
                      ...t,
                      status,
                      present: status === 'PRESENT' || status === 'LATE' || status === 'HALF_DAY' || status === 'MISSION',
                      absent: status === 'ABSENT',
                      motif: status === 'ABSENT' ? (motif || '') : '',
                      // ⭐ Pré-remplir l'observation SEULEMENT si vide (pour ne pas écraser une saisie manuelle)
                      observation: t.observation || defaultObservation,
                    }
                  : t
              );
              setDailyReport({ ...dailyReport, teacherAttendance: updated });
            } else {
              // Créer une nouvelle ligne
              const newEntry = {
                teacherId,
                name: teacherName,
                status,
                present: status === 'PRESENT' || status === 'LATE' || status === 'HALF_DAY' || status === 'MISSION',
                absent: status === 'ABSENT',
                motif: status === 'ABSENT' ? (motif || '') : '',
                observation: defaultObservation,
                replacement: '',
              };
              setDailyReport({ ...dailyReport, teacherAttendance: [...current, newEntry] });
            }
            toast.success(`✅ ${teacherName} marqué(e) "${status}"`);
          }}
          attendanceData={dailyReport?.teacherAttendance || []}
          disabled={config?.status === 'SUBMITTED' || config?.status === 'VALIDATED'}
        />
      </div>

      {/* 1. PRÉSENCE DES ENSEIGNANTS — auto-rempli depuis le pointage */}
      <Section title="1. Présence des enseignants" icon={Users}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Enseignant(e)</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Présent</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Absent</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Motif d'absence</th>
                {/* ⭐ Colonne "Observation" (remplace "Matière") — placée APRÈS "Motif d'absence"
                    Sert pour les cas de retard, mission, demi-journée (texte libre) */}
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Observation</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Remplacement</th>
              </tr>
            </thead>
            <tbody>
              {(dailyReport?.teacherAttendance || []).map((t: any, i: number) => (
                <tr key={i} className={t.absent ? "bg-rose-50/30" : ""}>
                  <td className="border border-slate-300 px-2 py-1 font-semibold">{t.name}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {t.present ? <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" /> : ''}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {t.absent ? <X className="h-3.5 w-3.5 text-rose-600 mx-auto" /> : ''}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-rose-700">{t.motif || ''}</td>
                  {/* ⭐ Observation : texte libre pour cas retard / mission / demi-journée */}
                  <td className="border border-slate-300 px-2 py-1">
                    <input
                      type="text"
                      value={t.observation || ''}
                      onChange={(e) => {
                        const updated = [...(dailyReport?.teacherAttendance || [])];
                        updated[i] = { ...t, observation: e.target.value };
                        setDailyReport({ ...dailyReport, teacherAttendance: updated });
                      }}
                      disabled={config?.status === 'SUBMITTED' || config?.status === 'VALIDATED'}
                      placeholder="Observation (retard, mission, demi-journée...)"
                      className="w-full px-1 py-0.5 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-1">
                    <input
                      type="text"
                      value={t.replacement || ''}
                      onChange={(e) => {
                        const updated = [...(dailyReport?.teacherAttendance || [])];
                        updated[i] = { ...t, replacement: e.target.value };
                        setDailyReport({ ...dailyReport, teacherAttendance: updated });
                      }}
                      disabled={config?.status === 'SUBMITTED' || config?.status === 'VALIDATED'}
                      placeholder="Nom du remplaçant..."
                      className="w-full px-1 py-0.5 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded"
                    />
                  </td>
                </tr>
              ))}
              {(!dailyReport?.teacherAttendance || dailyReport.teacherAttendance.length === 0) && (
                <tr><td colSpan={6} className="border border-slate-300 px-4 py-4 text-center text-slate-400">
                  Aucun enseignant pointé. Utilisez les boutons de pointage ci-dessus pour marquer les enseignants.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <label className="text-xs font-bold text-slate-600 block mb-1">Synthèse</label>
          <RichTextEditor value={dailyReport?.teacherAttendanceSynthesis || ""} onChange={html => setDailyReport({ ...dailyReport, teacherAttendanceSynthesis: html })} disabled={config?.status === 'SUBMITTED' || config?.status === 'VALIDATED'} minHeight="60px" />
        </div>
      </Section>

      {/* 2. PRÉSENCE DES ÉLÈVES — auto-récupération depuis appels enseignants */}
      <StudentPresenceSection
        dailyReport={dailyReport}
        setDailyReport={setDailyReport}
        dayDate={dayDate}
        disabled={config?.status === 'SUBMITTED' || config?.status === 'VALIDATED'}
      />

      {/* 3. DÉROULEMENT PÉDAGOGIQUE */}
      <Section title="3. Déroulement pédagogique" icon={BookOpen}>
        <RadioField label="Respect de l'emploi du temps" options={["Oui", "Non", "Partiel"]} value={dailyReport?.pedagogy?.edtRespect} onChange={v => setDailyReport({ ...dailyReport, pedagogy: { ...dailyReport?.pedagogy, edtRespect: v } })} />
        <div className="mt-2">
          <label className="text-xs font-bold text-slate-600 block mb-1">Cours non assurés ou modifiés</label>
          <RichTextEditor value={dailyReport?.pedagogy?.missedClasses || ""} onChange={html => setDailyReport({ ...dailyReport, pedagogy: { ...dailyReport?.pedagogy, missedClasses: html } })} minHeight="60px" />
        </div>
        <div className="mt-2">
          <label className="text-xs font-bold text-slate-600 block mb-1">Activités pédagogiques remarquables</label>
          <RichTextEditor value={dailyReport?.pedagogy?.remarkableActivities || ""} onChange={html => setDailyReport({ ...dailyReport, pedagogy: { ...dailyReport?.pedagogy, remarkableActivities: html } })} minHeight="60px" />
        </div>
        <RadioField label="Climat des classes" options={["Calme", "Moyen", "Perturbé"]} value={dailyReport?.pedagogy?.classClimate} onChange={v => setDailyReport({ ...dailyReport, pedagogy: { ...dailyReport?.pedagogy, classClimate: v } })} />
      </Section>

      {/* 4. DISCIPLINE & VIE SCOLAIRE */}
      <Section title="4. Discipline & vie scolaire" icon={Shield}>
        <RichTextField label="Comportements positifs observés" value={dailyReport?.discipline?.positiveBehaviors} onChange={v => setDailyReport({ ...dailyReport, discipline: { ...dailyReport?.discipline, positiveBehaviors: v } })} />
        <RichTextField label="Comportements problématiques" value={dailyReport?.discipline?.problemBehaviors} onChange={v => setDailyReport({ ...dailyReport, discipline: { ...dailyReport?.discipline, problemBehaviors: v } })} />
        <RichTextField label="Mesures correctives appliquées" value={dailyReport?.discipline?.correctiveMeasures} onChange={v => setDailyReport({ ...dailyReport, discipline: { ...dailyReport?.discipline, correctiveMeasures: v } })} />
      </Section>

      {/* 5. HYGIÈNE, SÉCURITÉ & LOGISTIQUE */}
      <Section title="5. Hygiène, sécurité & logistique" icon={Shield}>
        <RadioField label="Propreté des salles" options={["Très bonne", "Bonne", "Acceptable", "Insuffisante"]} value={dailyReport?.hygiene?.roomCleanliness} onChange={v => setDailyReport({ ...dailyReport, hygiene: { ...dailyReport?.hygiene, roomCleanliness: v } })} />
        <RadioField label="Toilettes" options={["Très propres", "Correctes", "À revoir", "Insalubres"]} value={dailyReport?.hygiene?.toilets} onChange={v => setDailyReport({ ...dailyReport, hygiene: { ...dailyReport?.hygiene, toilets: v } })} />
        <RadioField label="Eau" options={["Normale", "Instable", "Coupure"]} value={dailyReport?.hygiene?.water} onChange={v => setDailyReport({ ...dailyReport, hygiene: { ...dailyReport?.hygiene, water: v } })} />
        <RadioField label="Électricité" options={["Normale", "Instable", "Coupure"]} value={dailyReport?.hygiene?.electricity} onChange={v => setDailyReport({ ...dailyReport, hygiene: { ...dailyReport?.hygiene, electricity: v } })} />
        <RichTextField label="Points de réparation urgente" value={dailyReport?.hygiene?.urgentRepairs} onChange={v => setDailyReport({ ...dailyReport, hygiene: { ...dailyReport?.hygiene, urgentRepairs: v } })} />
      </Section>

      {/* 6. VISITES REÇUES */}
      <Section title="6. Visites reçues" icon={Users}>
        <RadioField label="Visite administrative (IEN, inspecteurs...)" options={["Oui", "Non"]} value={dailyReport?.visits?.adminVisit} onChange={v => setDailyReport({ ...dailyReport, visits: { ...dailyReport?.visits, adminVisit: v } })} />
        <RadioField label="Visite pédagogique (partenaires, ONG...)" options={["Oui", "Non"]} value={dailyReport?.visits?.pedagogicVisit} onChange={v => setDailyReport({ ...dailyReport, visits: { ...dailyReport?.visits, pedagogicVisit: v } })} />
        <RadioField label="Visite de parents" options={["Oui", "Non"]} value={dailyReport?.visits?.parentVisit} onChange={v => setDailyReport({ ...dailyReport, visits: { ...dailyReport?.visits, parentVisit: v } })} />
        <RichTextField label="Détails (visiteur, objet, durée)" value={dailyReport?.visits?.visitDetails} onChange={v => setDailyReport({ ...dailyReport, visits: { ...dailyReport?.visits, visitDetails: v } })} />
      </Section>

      {/* 7. COMMUNICATION & CIRCULAIRES */}
      <Section title="7. Communication & circulaires" icon={Users}>
        <RichTextField label="Instructions reçues de la direction" value={dailyReport?.communication?.directionInstructions} onChange={v => setDailyReport({ ...dailyReport, communication: { ...dailyReport?.communication, directionInstructions: v } })} />
        <RichTextField label="Besoins urgents communiqués" value={dailyReport?.communication?.urgentNeeds} onChange={v => setDailyReport({ ...dailyReport, communication: { ...dailyReport?.communication, urgentNeeds: v } })} />
      </Section>

      {/* 8. SYNTHÈSE GLOBALE DU JOUR */}
      <Section title="8. Synthèse globale du jour" icon={Sparkles}>
        <RichTextField label="Points forts" value={dailyReport?.dailySummary?.strengths} onChange={v => setDailyReport({ ...dailyReport, dailySummary: { ...dailyReport?.dailySummary, strengths: v } })} />
        <RichTextField label="Points à améliorer" value={dailyReport?.dailySummary?.improvements} onChange={v => setDailyReport({ ...dailyReport, dailySummary: { ...dailyReport?.dailySummary, improvements: v } })} />
        <RichTextField label="Recommandations" value={dailyReport?.dailySummary?.recommendations} onChange={v => setDailyReport({ ...dailyReport, dailySummary: { ...dailyReport?.dailySummary, recommendations: v } })} />
      </Section>

      {/* ⭐ Signatures bas de page — signature auto-récupérée depuis Liste des semainiers */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="text-center">
          <p className="text-xs font-bold text-slate-700 uppercase">Nom du Semainier</p>
          <p className="text-sm mt-1">{config?.teacherName || '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Signature</p>
          {config?.teacherSignature ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 mt-1">
              <img src={config.teacherSignature} alt="Signature du semainier" className="max-h-20 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 mt-1 text-xs text-slate-400 italic">
              ⚠️ Signature non disponible. Allez dans "Liste des semainiers" pour signer.
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-700 uppercase">Visa de la Direction</p>
          <p className="text-sm mt-1">{config?.status === 'VALIDATED' ? 'Validé' : '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Cachet</p>
          {config?.directorSignature && config?.status === 'VALIDATED' ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 mt-1">
              <img src={config.directorSignature} alt="Signature du directeur" className="max-h-20 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 mt-1 h-[80px] flex items-center justify-center text-xs text-slate-400 italic">
              {config?.status === 'SUBMITTED' ? 'En attente de validation du directeur' : '—'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CARTE: RAPPORT DE FIN DE SEMAINE (page 8 du document)
// ============================================================================
export function WeeklyReportCard({ config, weeklyReport, setWeeklyReport }: any) {
  // ⭐ Conversion JSONB → objet (peut venir comme string ou objet depuis l'API)
  const parseJson = (v: any) => {
    if (!v) return null;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return v;
  };

  const staffStats = parseJson(weeklyReport?.staffAttendanceStats);
  const studentStats = parseJson(weeklyReport?.studentAttendanceStats);

  return (
    <div className="bg-white rounded-xl border-2 border-purple-800 p-4">
      {/* En-tête rapport hebdo */}
      <div className="text-center border-b border-purple-300 pb-2 mb-4 bg-purple-50 -m-4 p-4 mb-4">
        <h2 className="text-lg font-bold text-purple-900">RAPPORT DE FIN DE SEMAINE</h2>
        <p className="text-sm text-purple-700">
          Semaine {config.weekNumber} | Trimestre {config.trimester}
        </p>
        <p className="text-xs text-purple-600 mt-0.5">
          Période : {formatDateShort(config.weekStartDate)} → {formatDateShort(config.weekEndDate)}
        </p>
      </div>

      {/* ⭐ Bloc statistiques agrégées (auto-calculées depuis les 5 rapports journaliers) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Présence enseignants"
          value={staffStats?.averagePresenceRate != null ? `${staffStats.averagePresenceRate}%` : '—'}
          sub={`${staffStats?.totalPresent || 0}/${staffStats?.totalRecords || 0} présences`}
          color="blue"
        />
        <StatCard
          label="Présence élèves"
          value={studentStats?.averageAttendanceRate != null ? `${studentStats.averageAttendanceRate}%` : '—'}
          sub={`${studentStats?.totalAbsent || 0} absences cumulées`}
          color="emerald"
        />
        <StatCard
          label="Jours couverts"
          value={`${staffStats?.daysCovered || 0}/5`}
          sub="rapports journaliers"
          color="amber"
        />
        <StatCard
          label="Classes à risque"
          value={`${studentStats?.highAbsenceClasses?.length || 0}`}
          sub=">30% d'absences"
          color="rose"
        />
      </div>

      {/* 1. SYNTHÈSE PRÉSENCE ENSEIGNANTS */}
      <WeeklySection title="1. Synthèse présence des enseignants" color="blue">
        {staffStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
            <div className="bg-blue-50 p-2 rounded">
              <p className="text-slate-500">Total présences</p>
              <p className="font-bold text-blue-700 text-base">{staffStats.totalPresent}</p>
            </div>
            <div className="bg-rose-50 p-2 rounded">
              <p className="text-slate-500">Total absences</p>
              <p className="font-bold text-rose-700 text-base">{staffStats.totalAbsent}</p>
            </div>
            <div className="bg-amber-50 p-2 rounded">
              <p className="text-slate-500">Total retards</p>
              <p className="font-bold text-amber-700 text-base">{staffStats.totalLate}</p>
            </div>
            <div className="bg-emerald-50 p-2 rounded">
              <p className="text-slate-500">Taux moyen</p>
              <p className="font-bold text-emerald-700 text-base">{staffStats.averagePresenceRate}%</p>
            </div>
          </div>
        )}
        <RichTextField label="Observations / motifs récurrents"
          value={weeklyReport?.staffAttendanceObservations}
          onChange={v => setWeeklyReport({ ...weeklyReport, staffAttendanceObservations: v })} />
      </WeeklySection>

      {/* 2. SYNTHÈSE PRÉSENCE ÉLÈVES */}
      <WeeklySection title="2. Synthèse présence des élèves" color="emerald">
        {studentStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
            <div className="bg-emerald-50 p-2 rounded">
              <p className="text-slate-500">Total présences</p>
              <p className="font-bold text-emerald-700 text-base">{studentStats.totalPresent}</p>
            </div>
            <div className="bg-rose-50 p-2 rounded">
              <p className="text-slate-500">Total absences</p>
              <p className="font-bold text-rose-700 text-base">{studentStats.totalAbsent}</p>
            </div>
            <div className="bg-amber-50 p-2 rounded">
              <p className="text-slate-500">Total retards</p>
              <p className="font-bold text-amber-700 text-base">{studentStats.totalLate}</p>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <p className="text-slate-500">Taux moyen</p>
              <p className="font-bold text-blue-700 text-base">{studentStats.averageAttendanceRate}%</p>
            </div>
          </div>
        )}
        {studentStats?.highAbsenceClasses?.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-800 mb-2">
            <strong>⚠️ Classes à forte absence (&gt;30%) :</strong> {studentStats.highAbsenceClasses.join(', ')}
          </div>
        )}
        <RichTextField label="Analyse globale des absences de la semaine"
          value={weeklyReport?.studentAttendanceAnalysis}
          onChange={v => setWeeklyReport({ ...weeklyReport, studentAttendanceAnalysis: v })} />
      </WeeklySection>

      {/* 3. BILAN PÉDAGOGIQUE */}
      <WeeklySection title="3. Bilan pédagogique de la semaine" color="amber">
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 mb-2">
          <strong>Synthèse auto-agrégée :</strong> {weeklyReport?.pedagogySummary || '—'}
        </div>
        <RichTextField label="Analyse pédagogique détaillée"
          value={weeklyReport?.pedagogyAnalysis}
          onChange={v => setWeeklyReport({ ...weeklyReport, pedagogyAnalysis: v })} />
      </WeeklySection>

      {/* 4. BILAN DISCIPLINE */}
      <WeeklySection title="4. Bilan discipline & vie scolaire" color="purple">
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-900 mb-2">
          <strong>Incidents de la semaine :</strong> {weeklyReport?.disciplineSummary || 'Aucun incident signalé'}
        </div>
        <RichTextField label="Analyse discipline & mesures prises"
          value={weeklyReport?.disciplineAnalysis}
          onChange={v => setWeeklyReport({ ...weeklyReport, disciplineAnalysis: v })} />
      </WeeklySection>

      {/* 5. BILAN HYGIÈNE & LOGISTIQUE */}
      <WeeklySection title="5. Bilan hygiène, sécurité & logistique" color="cyan">
        <div className="bg-cyan-50 border border-cyan-200 rounded p-2 text-xs text-cyan-900 mb-2">
          <strong>Réparations urgentes signalées :</strong> {weeklyReport?.hygieneSummary || 'Aucune'}
        </div>
        <RichTextField label="Actions entreprises / suivi logistique"
          value={weeklyReport?.hygieneActions}
          onChange={v => setWeeklyReport({ ...weeklyReport, hygieneActions: v })} />
      </WeeklySection>

      {/* 6. VISITES & COMMUNICATIONS DE LA SEMAINE */}
      <WeeklySection title="6. Visites et communications de la semaine" color="pink">
        <div className="bg-pink-50 border border-pink-200 rounded p-2 text-xs text-pink-900 mb-2">
          <strong>Synthèse :</strong> {weeklyReport?.visitsAndCommsSummary || 'Rien à signaler'}
        </div>
        <RichTextField label="Détails visites & communications direction"
          value={weeklyReport?.visitsCommunicationsDetail}
          onChange={v => setWeeklyReport({ ...weeklyReport, visitsCommunicationsDetail: v })} />
      </WeeklySection>

      {/* 7. RECOMMANDATIONS GÉNÉRALES POUR LA DIRECTION */}
      <WeeklySection title="7. Recommandations générales pour la direction" color="indigo">
        <RichTextEditor
          value={weeklyReport?.recommendations || ""}
          onChange={html => setWeeklyReport({ ...weeklyReport, recommendations: html })}
          minHeight="120px"
        />
      </WeeklySection>

      {/* ⭐ Signatures bas de page — auto-récupérées */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-purple-300 mt-6">
        <div className="text-center">
          <p className="text-xs font-bold text-purple-700 uppercase">Nom du Semainier</p>
          <p className="text-sm mt-1">{config?.teacherName || '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Signature</p>
          {config?.teacherSignature ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 mt-1">
              <img src={config.teacherSignature} alt="Signature du semainier" className="max-h-20 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 mt-1 text-xs text-slate-400 italic">
              ⚠️ Signature non disponible.
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-purple-700 uppercase">Visa de la Direction</p>
          <p className="text-sm mt-1">{config?.status === 'VALIDATED' ? 'Validé' : '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Cachet</p>
          {config?.directorSignature && config?.status === 'VALIDATED' ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 mt-1">
              <img src={config.directorSignature} alt="Signature du directeur" className="max-h-20 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 mt-1 h-[80px] flex items-center justify-center text-xs text-slate-400 italic">
              {config?.status === 'SUBMITTED' ? 'En attente de validation' : '—'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ⭐ SECTION 2 — PRÉSENCE DES ÉLÈVES (auto-récupération depuis appels enseignants)
// ============================================================================
//    Backend endpoint: POST /api/pedagogy-space/seminar-daily-report/:id/sync-from-students
//    Le backend lit attendance_records pour la date du jour, agrège par classe,
//    calcule le taux de présence global, identifie les classes > 30% d'absents,
//    et persiste dans le champ JSONB "studentPresence" du rapport journalier.
//
//    Cette section affiche :
//      1. Bandeau stats synthétiques (4 chiffres clés)
//      2. Tableau par classe (className | présents | absents | retards | taux)
//      3. Alerte classes > 30% d'absents
//      4. Champ manuel "Absences signalées par les parents"
//      5. Editeur RichText "Cas particuliers observés"
// ============================================================================
function StudentPresenceSection({ dailyReport, setDailyReport, dayDate, disabled }: any) {
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  // ⭐ Récupérer le studentPresence (compatible string JSON ou objet déjà parsé)
  const getSp = (): any => {
    const sp = dailyReport?.studentPresence;
    if (!sp) return null;
    if (typeof sp === 'string') {
      try { return JSON.parse(sp); } catch { return null; }
    }
    return sp;
  };
  const sp = getSp();

  // ⭐ Mapper les champs du backend → affichage (compatibilité ancien/nouveau format)
  const attendanceRate = sp?.attendanceRate ?? sp?.globalRate ?? null;
  const byClass: any[] = sp?.byClass || [];
  const summary = sp?.summary || null;
  const highAbsenceClasses: string[] = sp?.highAbsenceClasses || [];
  const syncedAtFromData = sp?._syncedAt || null;
  const source = sp?._source || null;
  // ⭐ Diagnostic info (renvoyé par le backend depuis le fix)
  const queriedDate = sp?._queriedDate || dayDate || null;
  const queriedStrategy: 'day' | 'week' | 'recent' | null = sp?._queriedStrategy || null;
  const queriedRange: { start: string; end: string } | null = sp?._queriedRange || null;
  const totalFound = sp?._totalFound ?? (summary?.totalRecords ?? 0);
  const classesCount = sp?._classesCount ?? 0;
  // ⭐ Si la sync a été faite mais 0 records trouvés → afficher warning
  const isSyncedButEmpty = source === 'STUDENTS' && totalFound === 0;

  // ⭐ Libellé de la stratégie utilisée pour l'affichage
  const strategyLabel = queriedStrategy === 'day'
    ? 'Date du rapport'
    : queriedStrategy === 'week'
      ? 'Plage semaine'
      : queriedStrategy === 'recent'
        ? '7 derniers jours'
        : null;

  // ⭐ Helper : regrouper byClass (qui peut être par statut) par classId/className
  //    Le backend renvoie byClass = [{ classId, className, status, count, lateCount, notes }]
  //    Pour chaque classe, on agrège les statuts en présents/absents/retards/total.
  const byClassAggregated: any[] = (() => {
    if (!byClass || byClass.length === 0) return [];
    const map = new Map<string, { className: string; total: number; present: number; absent: number; late: number }>();
    for (const r of byClass) {
      const key = r.classId || r.className;
      if (!map.has(key)) {
        map.set(key, { className: r.className || '—', total: 0, present: 0, absent: 0, late: 0 });
      }
      const entry = map.get(key)!;
      entry.total += Number(r.count) || 0;
      if (r.status === 'PRESENT') entry.present += Number(r.count) || 0;
      // ⭐ FIX : compter ABSENT_HALF comme absent (l'élève est absent au moins une demi-journée)
      else if (r.status === 'ABSENT' || r.status === 'ABSENT_HALF') entry.absent += Number(r.count) || 0;
      // ⭐ FIX : utiliser lateCount (boolean late multiplié par count) au lieu de status==='LATE'
      entry.late += Number(r.lateCount) || 0;
    }
    // Calculer le taux de présence par classe et marquer celles > 30% absent
    return Array.from(map.values()).map(c => ({
      ...c,
      rate: c.total > 0 ? Number(((c.present / c.total) * 100).toFixed(1)) : 0,
      highAbsence: c.total > 0 && (c.absent / c.total) > 0.3,
    }));
  })();

  // ⭐ Bouton "Sync depuis appels" — appelle POST /seminar-daily-report/:id/sync-from-students
  //    Ne pas écraser si l'utilisateur a déjà édité manuellement (détecté via _manualEdit=true)
  const handleSync = async () => {
    if (!dailyReport?.id) {
      toast.error('Aucun rapport journalier à synchroniser');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-daily-report/${dailyReport.id}/sync-from-students`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.skipped) {
          toast.info('Sync ignorée', {
            description: data.reason || 'La section a été éditée manuellement.',
          });
        } else {
          throw new Error(data?.message || 'Erreur de synchronisation');
        }
      } else {
        // ⭐ Mettre à jour le rapport avec les données synchronisées
        //    Le backend renvoie { synced: true, studentPresence: {...} }
        const newSp = data.studentPresence || data;
        setDailyReport({
          ...dailyReport,
          studentPresence: newSp,
        });
        setSyncedAt(newSp?._syncedAt || new Date().toISOString());
        toast.success('✅ Présence des élèves synchronisée depuis les appels', {
          description: `${newSp?.summary?.totalRecords || 0} enregistrements • taux=${newSp?.attendanceRate || 0}%`,
        });
      }
    } catch (e: any) {
      toast.error('Erreur de synchronisation', { description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // ⭐ Marquer la section comme éditée manuellement dès qu'on touche aux champs manuels
  //    (parentAbsences, specialCases) — pour empêcher un futur sync d'écraser
  const markManualEdit = () => {
    const currentSp = getSp() || {};
    if (currentSp._manualEdit === true) return; // déjà marqué
    setDailyReport({
      ...dailyReport,
      studentPresence: { ...currentSp, _manualEdit: true },
    });
  };

  return (
    <Section title="2. Présence des élèves" icon={Users}>
      {/* ⭐ Barre d'actions : Sync depuis appels + indicateur de source/dernière sync */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
        <button
          onClick={handleSync}
          disabled={syncing || disabled}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          title="Récupère automatiquement les appels effectués par les enseignants ce jour pour toutes les classes"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Sync depuis appels enseignants
        </button>
        {source && (
          <span className="text-[10px] font-bold uppercase text-emerald-700 bg-white px-2 py-0.5 rounded">
            Source : {source}
          </span>
        )}
        {queriedDate && (
          <span className="text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200" title="Plage de dates recherchée pour récupérer les appels élèves">
            📅 {strategyLabel || 'Date du rapport'} : {
              queriedRange
                ? `${new Date(queriedRange.start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} → ${new Date(queriedRange.end).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
                : new Date(queriedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
            }
          </span>
        )}
        {(syncedAt || syncedAtFromData) && (
          <span className="text-[10px] text-slate-600">
            Dernière sync : {new Date(syncedAt || syncedAtFromData).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        )}
        <span className="text-[10px] text-slate-500 ml-auto">
          {disabled
            ? '🔒 Rapport verrouillé (soumis/validé)'
            : '💡 La sync ne remplit QUE les champs calculés. Les champs "Absences parents" et "Cas particuliers" restent manuels.'}
        </span>
      </div>

      {/* ⭐ Warning : si sync a été faite mais 0 records trouvés */}
      {isSyncedButEmpty && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-900">
                Aucun appel élève trouvé — sync a essayé 3 stratégies sans résultat
              </p>
              <p className="text-[11px] text-amber-800 mt-1">
                Le système a recherché les appels avec :
                <br />1. <strong>Date du rapport journalier</strong> ({queriedDate ? new Date(queriedDate).toLocaleDateString('fr-FR') : '—'})
                <br />2. <strong>Plage de la semaine</strong> ({queriedRange ? `${new Date(queriedRange.start).toLocaleDateString('fr-FR')} → ${new Date(queriedRange.end).toLocaleDateString('fr-FR')}` : 'non applicable'})
                <br />3. <strong>7 derniers jours</strong>
                <br /><br />
                Aucun appel n'a été enregistré pour ces plages. Les enseignants doivent prendre l'appel via le module <strong>Appels</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Bandeau stats synthétiques (4 chiffres clés) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className={cn(
          "border rounded-lg p-2.5 text-center",
          attendanceRate != null && Number(attendanceRate) >= 90
            ? "border-emerald-200 bg-emerald-50"
            : attendanceRate != null && Number(attendanceRate) >= 70
              ? "border-amber-200 bg-amber-50"
              : "border-rose-200 bg-rose-50"
        )}>
          <p className="text-[10px] font-semibold uppercase opacity-70">Taux présence global</p>
          <p className="text-2xl font-bold mt-0.5">
            {attendanceRate != null ? `${Number(attendanceRate).toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">
            {/* ⭐ FIX : ne pas afficher "0/0 élèves" si totalRecords=0 — afficher "—" à la place
                pour éviter la confusion (l'utilisateur a dit "C'est pas cohérent 0/0 élèves
                avec tout ce nombre d'élèves qu'il y a") */}
            {summary && summary.totalRecords > 0
              ? `${summary.present}/${summary.totalRecords} élèves`
              : summary && source === 'STUDENTS'
                ? 'Aucun appel trouvé'
                : 'Non synchronisé'}
          </p>
        </div>
        <div className="border border-rose-200 bg-rose-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase opacity-70 text-rose-700">Total absents</p>
          <p className="text-2xl font-bold mt-0.5 text-rose-700">
            {/* ⭐ FIX : afficher "—" au lieu de 0 quand pas de données */}
            {summary && summary.totalRecords > 0 ? (summary.absent ?? 0) : '—'}
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">
            {byClassAggregated.length > 0 ? `${byClassAggregated.length} classes pointées` : 'N/A'}
          </p>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase opacity-70 text-amber-700">Total retards</p>
          <p className="text-2xl font-bold mt-0.5 text-amber-700">
            {/* ⭐ FIX : afficher "—" au lieu de 0 quand pas de données */}
            {summary && summary.totalRecords > 0 ? (summary.late ?? sp?.lateStudents ?? 0) : '—'}
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">signalés ce jour</p>
        </div>
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase opacity-70 text-purple-700">Classes à risque</p>
          <p className="text-2xl font-bold mt-0.5 text-purple-700">
            {highAbsenceClasses.length}
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">&gt; 30% d'absents</p>
        </div>
      </div>

      {/* ⭐ Alerte classes à forte absence (> 30%) */}
      {highAbsenceClasses.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-800">
                Classes avec plus de 30% d'absents :
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {highAbsenceClasses.map((cn, i) => (
                  <span key={i} className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">
                    {cn}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-rose-600 mt-1.5 italic">
                Ces classes nécessitent un suivi particulier — vérifier les motifs d'absence et notifier les parents si nécessaire.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Tableau par classe — désagrégation des présences */}
      {byClassAggregated.length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Classe</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Effectif</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Présents</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Absents</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Retards</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Taux présence</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Alerte</th>
              </tr>
            </thead>
            <tbody>
              {byClassAggregated.map((c, i) => (
                <tr key={i} className={c.highAbsence ? "bg-rose-50/40" : ""}>
                  <td className="border border-slate-300 px-2 py-1.5 font-semibold">{c.className}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{c.total}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-emerald-700 font-bold">{c.present}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-rose-700 font-bold">{c.absent}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-amber-700">{c.late}</td>
                  <td className={cn(
                    "border border-slate-300 px-2 py-1.5 text-center font-bold",
                    c.rate >= 90 ? "text-emerald-700" : c.rate >= 70 ? "text-amber-700" : "text-rose-700"
                  )}>
                    {c.rate.toFixed(1)}%
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">
                    {c.highAbsence ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded font-bold">
                        <AlertCircle className="h-2.5 w-2.5" /> &gt;30%
                      </span>
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-300 px-2 py-1.5">TOTAL</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center">{byClassAggregated.reduce((s, c) => s + c.total, 0)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center text-emerald-700">{byClassAggregated.reduce((s, c) => s + c.present, 0)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center text-rose-700">{byClassAggregated.reduce((s, c) => s + c.absent, 0)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center text-amber-700">{byClassAggregated.reduce((s, c) => s + c.late, 0)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center" colSpan={2}>
                  {(() => {
                    const tot = byClassAggregated.reduce((s, c) => s + c.total, 0);
                    const pres = byClassAggregated.reduce((s, c) => s + c.present, 0);
                    return tot > 0 ? `${((pres / tot) * 100).toFixed(1)}%` : '—';
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold mb-0.5">Aucune donnée d'appel synchronisée pour ce jour.</p>
              <p>Cliquez sur <strong>"Sync depuis appels enseignants"</strong> pour récupérer automatiquement
              les présences saisies par les enseignants dans leur module d'appel quotidien.
              Vous pourrez ensuite ajouter manuellement les absences signalées par les parents.</p>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Champ manuel : Absences signalées par les parents ( reste manuel) */}
      <Field
        label="Absences signalées par les parents (manuel)"
        value={sp?.parentAbsences ?? sp?.parentNotifiedAbsences}
        onChange={v => {
          markManualEdit();
          setDailyReport({
            ...dailyReport,
            studentPresence: { ...getSp(), parentAbsences: v, _manualEdit: true },
          });
        }}
      />

      {/* ⭐ Editeur RichText : Cas particuliers observés (manuel) */}
      <div className="mt-2">
        <label className="text-xs font-bold text-slate-600 block mb-1">Cas particuliers observés (manuel)</label>
        <RichTextEditor
          value={sp?.specialCases || ""}
          onChange={html => {
            markManualEdit();
            setDailyReport({
              ...dailyReport,
              studentPresence: { ...getSp(), specialCases: html, _manualEdit: true },
            });
          }}
          disabled={disabled}
          minHeight="60px"
        />
      </div>
    </Section>
  );
}

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================
function Section({ title, icon: Icon, children }: any) {
  return (
    <section className="border-l-4 border-blue-300 pl-4 mb-6">
      <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function WeeklySection({ title, color, children }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-400 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-400 bg-amber-50 text-amber-700',
    purple: 'border-purple-400 bg-purple-50 text-purple-700',
    cyan: 'border-cyan-400 bg-cyan-50 text-cyan-700',
    pink: 'border-pink-400 bg-pink-50 text-pink-700',
    indigo: 'border-indigo-400 bg-indigo-50 text-indigo-700',
  };
  return (
    <section className={cn("border-l-4 pl-4 mb-6", `border-${color}-400`)}>
      <h3 className={cn("text-sm font-bold text-slate-900 uppercase mb-3 px-3 py-2 rounded-lg flex items-center gap-2",
        colorClasses[color] || colorClasses.blue)}>
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function StatCard({ label, value, sub, color }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return (
    <div className={cn("border rounded-lg p-3 text-center", colorClasses[color] || colorClasses.blue)}>
      <p className="text-xs font-semibold opacity-70 uppercase">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function Field({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
      <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
    </div>
  );
}

function RichTextField({ label, value, onChange }: any) {
  return (
    <div className="mt-2">
      <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
      <RichTextEditor value={value || ""} onChange={html => onChange(html)} minHeight="60px" />
    </div>
  );
}

function RadioField({ label, options, value, onChange }: any) {
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <label className="text-xs font-bold text-slate-600">{label} :</label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt: string) => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={cn("px-3 py-1 rounded text-xs font-bold",
              value === opt ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
