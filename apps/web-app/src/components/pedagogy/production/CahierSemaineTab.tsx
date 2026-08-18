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
  Plus, Trash2, CheckCircle2, X, Zap, Hand, ChevronRight,
  ClipboardList, Users, BookOpen, Shield, Sparkles, CalendarRange,
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
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Liste des semainiers de l'année.</strong> Cliquez sur "Signer" pour signer.
          Votre signature sera propagée automatiquement à toutes les semaines où vous êtes désigné.
        </p>
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
                return (
                  <tr key={cfg.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-bold text-slate-900">S{cfg.weekNumber}</td>
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
                          <button
                            onClick={() => onDeleteSignature?.(cfg.teacherId)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Supprimer la signature">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : cfg.teacherId ? (
                        <button
                          onClick={() => onSign(cfg.id, null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Signer
                        </button>
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
function CahierSemainierContent({ configs, currentUserId, academicYearId, tenantId }: any) {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  // ⭐ selectedDay : 1-5 = Lun-Ven, 6 = Rapport de fin de semaine
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
    </div>
  );
}

// ============================================================================
// CARTE: RAPPORT JOURNALIER (avec date précise "Lundi 23/07/2026")
// ============================================================================
function DailyReportCard({ config, selectedDay, dailyReport, setDailyReport }: any) {
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

      {/* ⭐ Panneau de pointage des enseignants par le semainier */}
      <div className="mb-6">
        <SemainierAttendancePanel date={dayDate} />
      </div>

      {/* 1. PRÉSENCE DES ENSEIGNANTS */}
      <Section title="1. Présence des enseignants" icon={Users}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Enseignant(e)</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Matière</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Présent</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-bold">Absent</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Motif d'absence</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-bold">Remplacement</th>
              </tr>
            </thead>
            <tbody>
              {(dailyReport?.teacherAttendance || []).map((t: any, i: number) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-1">{t.name}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.subject}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{t.present ? '✓' : ''}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{t.absent ? '✗' : ''}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.motif || ''}</td>
                  <td className="border border-slate-300 px-2 py-1">{t.replacement || ''}</td>
                </tr>
              ))}
              {(!dailyReport?.teacherAttendance || dailyReport.teacherAttendance.length === 0) && (
                <tr><td colSpan={6} className="border border-slate-300 px-4 py-4 text-center text-slate-400">Aucun enseignant chargé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <label className="text-xs font-bold text-slate-600 block mb-1">Synthèse</label>
          <RichTextEditor value={dailyReport?.teacherAttendanceSynthesis || ""} onChange={html => setDailyReport({ ...dailyReport, teacherAttendanceSynthesis: html })} minHeight="60px" />
        </div>
      </Section>

      {/* 2. PRÉSENCE DES ÉLÈVES */}
      <Section title="2. Présence des élèves" icon={Users}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Taux de présence global" value={dailyReport?.studentPresence?.globalRate} onChange={v => setDailyReport({ ...dailyReport, studentPresence: { ...dailyReport?.studentPresence, globalRate: v } })} />
          <Field label="Classes avec + de 10% d'absences" value={dailyReport?.studentPresence?.classesOver10} onChange={v => setDailyReport({ ...dailyReport, studentPresence: { ...dailyReport?.studentPresence, classesOver10: v } })} />
          <Field label="Absences signalées par les parents" value={dailyReport?.studentPresence?.parentAbsences} onChange={v => setDailyReport({ ...dailyReport, studentPresence: { ...dailyReport?.studentPresence, parentAbsences: v } })} />
          <Field label="Retards" value={dailyReport?.studentPresence?.lateStudents} onChange={v => setDailyReport({ ...dailyReport, studentPresence: { ...dailyReport?.studentPresence, lateStudents: v } })} />
        </div>
        <div className="mt-2">
          <label className="text-xs font-bold text-slate-600 block mb-1">Cas particuliers observés</label>
          <RichTextEditor value={dailyReport?.studentPresence?.specialCases || ""} onChange={html => setDailyReport({ ...dailyReport, studentPresence: { ...dailyReport?.studentPresence, specialCases: html } })} minHeight="60px" />
        </div>
      </Section>

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

      {/* Signatures bas de page */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="text-center">
          <p className="text-xs font-bold text-slate-700 uppercase">Nom du Semainier</p>
          <p className="text-sm mt-1">{config?.teacherName || '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Signature</p>
          <div className="h-16" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-700 uppercase">Visa de la Direction</p>
          <p className="text-sm mt-1">—</p>
          <p className="text-xs text-slate-500 mt-4">Cachet</p>
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CARTE: RAPPORT DE FIN DE SEMAINE (page 8 du document)
// ============================================================================
function WeeklyReportCard({ config, weeklyReport, setWeeklyReport }: any) {
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

      {/* Signatures bas de page */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-purple-300 mt-6">
        <div className="text-center">
          <p className="text-xs font-bold text-purple-700 uppercase">Nom du Semainier</p>
          <p className="text-sm mt-1">{config?.teacherName || '—'}</p>
          <p className="text-xs text-slate-500 mt-4">Signature</p>
          <div className="h-16" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-purple-700 uppercase">Visa de la Direction</p>
          <p className="text-sm mt-1">—</p>
          <p className="text-xs text-slate-500 mt-4">Cachet</p>
          <div className="h-16" />
        </div>
      </div>
    </div>
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
