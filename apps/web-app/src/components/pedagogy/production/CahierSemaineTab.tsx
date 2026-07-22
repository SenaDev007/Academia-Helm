"use client";

/**
 * ============================================================================
 * CAHIER DU SEMAINIER — Suivi quotidien & hebdomadaire de l'établissement
 * ============================================================================
 * 
 * 3 sous-onglets :
 *   1. Paramétrage (PROMOTER + DIRECTOR uniquement)
 *   2. Liste des semainiers (tous — signature enseignant)
 *   3. Cahier du Semainier (rapport quotidien + hebdomadaire)
 *
 * Conforme au PDF "Cahier du Semainier" (222 pages, 36 semaines × 6 pages).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Settings, List, FileText, Loader2, Save, RefreshCw,
  Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, X, Zap,
  ClipboardList, Users, BookOpen, Shield, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppSession } from "@/contexts/AppSessionContext";

interface CahierSemaineTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");
const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                     "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export function CahierSemaineTab({ tenantId, academicYearId, teacherId }: CahierSemaineTabProps) {
  const { user } = useAppSession();
  const [activeSubTab, setActiveSubTab] = useState<"config" | "list" | "cahier">("config");
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // ⭐ Permissions : Paramétrage visible uniquement pour PROMOTER + DIRECTOR
  const canConfigure = ['PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
    'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR',
    'admin', 'director'].includes(user?.role || '');

  // === Chargement des données ===
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Charger les configs
      const configRes = await fetch(`/api/pedagogy-space/seminar-config?academicYearId=${academicYearId}`, { credentials: "include" });
      const configData = await configRes.json();
      setConfigs(Array.isArray(configData) ? configData : []);

      // Charger les enseignants (maternelle + primaire, piste FR)
      const teacherRes = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      // Les enseignants viendront d'une autre source — pour l'instant on charge les classes
      const classData = await teacherRes.json();
      setClasses(Array.isArray(classData) ? classData : []);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId]);

  useEffect(() => { loadData(); }, [loadData]);

  // === Génération automatique ===
  const handleAutoGenerate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/seminar-config/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academicYearId, tenantId }),
      });
      if (!res.ok) throw new Error("Erreur de génération");
      toast.success("✅ Semainiers générés automatiquement");
      loadData();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
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

  // === Signature enseignant ===
  const handleSign = async (configId: string, signature: string | null) => {
    if (!signature) return;
    await handleUpdateConfig(configId, { teacherSignature: signature, status: "SIGNED" });
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
          teachers={teachers}
          classes={classes}
          saving={saving}
          onAutoGenerate={handleAutoGenerate}
          onUpdate={handleUpdateConfig}
          onReload={loadData}
        />
      )}

      {/* === SOUS-ONGLET 2: LISTE DES SEMAINIERS === */}
      {activeSubTab === "list" && !loading && (
        <ListeSemainiersTab
          configs={configs}
          currentUserId={user?.id || ""}
          onSign={handleSign}
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
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 1: PARAMÉTRAGE
// ============================================================================
function ParametrageTab({ configs, teachers, classes, saving, onAutoGenerate, onUpdate, onReload }: any) {
  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Paramétrage des semainiers de l'année</h3>
          <p className="text-xs text-slate-500">{configs.length} semaine(s) configurée(s)</p>
        </div>
        <div className="flex-1" />
        <button onClick={onReload} className="p-2 hover:bg-slate-200 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={onAutoGenerate} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Générer automatiquement
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucun semainier configuré</p>
          <p className="text-sm text-slate-500 mt-1">Cliquez sur "Générer automatiquement" pour créer les semainiers de l'année par rotation.</p>
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
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg: any) => (
                <tr key={cfg.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-900">S{cfg.weekNumber}</td>
                  <td className="px-4 py-2.5">T{cfg.trimester}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {new Date(cfg.weekStartDate).toLocaleDateString('fr-FR')} → {new Date(cfg.weekEndDate).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="text" value={cfg.teacherName || ''} disabled
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{cfg.classIds?.join(', ') || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {cfg.teacherSignature ? (
                      <img src={cfg.teacherSignature} alt="Signature" className="h-8 mx-auto" />
                    ) : (
                      <span className="text-slate-300 text-xs">En attente</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold",
                      cfg.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {cfg.status === 'SIGNED' ? 'Signé' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 2: LISTE DES SEMAINIERS (avec signature enseignant)
// ============================================================================
function ListeSemainiersTab({ configs, currentUserId, onSign }: any) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Liste des semainiers de l'année.</strong> Chaque enseignant peut signer UNIQUEMENT
          la semaine qui lui a été assignée. Les autres lignes sont en lecture seule.
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
                const isMyRow = cfg.teacherId === currentUserId;
                return (
                  <tr key={cfg.id} className={cn("border-b border-slate-100", !isMyRow && "opacity-60 bg-slate-50/50")}>
                    <td className="px-4 py-2.5 font-bold text-slate-900">S{cfg.weekNumber}</td>
                    <td className="px-4 py-2.5">T{cfg.trimester}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {new Date(cfg.weekStartDate).toLocaleDateString('fr-FR')} → {new Date(cfg.weekEndDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{cfg.teacherName || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{cfg.classIds?.join(', ') || '—'}</td>
                    <td className="px-4 py-2.5">
                      {cfg.teacherSignature ? (
                        <div className="flex flex-col items-center gap-1">
                          <img src={cfg.teacherSignature} alt="Signature" className="h-12" />
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Signé
                          </span>
                        </div>
                      ) : isMyRow ? (
                        <SignatureCanvas
                          width={200}
                          height={80}
                          placeholder="Ma signature"
                          onSignatureChange={(data) => onSign(cfg.id, data)}
                        />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
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
// SOUS-ONGLET 3: CAHIER DU SEMAINIER (rapport quotidien + hebdomadaire)
// ============================================================================
function CahierSemainierContent({ configs, currentUserId, academicYearId, tenantId }: any) {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currentConfig = configs.find((c: any) => c.weekNumber === selectedWeek);

  // Charger le rapport du jour
  useEffect(() => {
    if (!currentConfig) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/seminar-daily-report?configId=${currentConfig.id}&dayOfWeek=${selectedDay}`, { credentials: "include" });
        const data = await res.json();
        setDailyReport(data?.id ? data : null);
      } catch { setDailyReport(null); }
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

  const DAYS = [
    { num: 1, label: "Lundi" }, { num: 2, label: "Mardi" },
    { num: 3, label: "Mercredi" }, { num: 4, label: "Jeudi" },
    { num: 5, label: "Vendredi" },
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
              <option key={c.id} value={c.weekNumber}>S{c.weekNumber} — T{c.trimester} ({new Date(c.weekStartDate).toLocaleDateString('fr-FR')})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Jour</label>
          <div className="flex gap-1">
            {DAYS.map(d => (
              <button key={d.num} onClick={() => setSelectedDay(d.num)}
                className={cn("px-3 py-2 rounded-lg text-sm font-semibold",
                  selectedDay === d.num ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={handleSaveDaily} disabled={!dailyReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          <Save className="h-4 w-4" /> Enregistrer
        </button>
      </div>

      {/* En-tête du jour */}
      {currentConfig && (
        <div className="bg-white rounded-xl border-2 border-slate-800 p-4">
          <div className="text-center border-b border-slate-300 pb-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900">CAHIER DU SEMAINIER</h2>
            <p className="text-sm text-slate-600">
              Semaine {selectedWeek} | Trimestre {currentConfig.trimester} | Jour {selectedDay} : {DAYS.find(d => d.num === selectedDay)?.label}
            </p>
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
              <p className="text-sm mt-1">{currentConfig?.teacherName || '—'}</p>
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
      )}
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
    <div className="flex items-center gap-2 mt-2">
      <label className="text-xs font-bold text-slate-600">{label} :</label>
      <div className="flex gap-2">
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
