"use client";

/**
 * ============================================================================
 * SAISIEMASTER — Workspace (saissiemaster.academiahelm.com)
 * ============================================================================
 *
 * Module séparé pour la saisie des notes par classe et matière avec
 * 4 types d'évaluations normalisés :
 *   - EF1 : Évaluation Formative 1
 *   - ES1 : Évaluation Sommative 1
 *   - ES2 : Évaluation Sommative 2
 *   - ES3 : Évaluation Sommative 3
 *
 * Workflow utilisateur :
 *   1. L'enseignant sélectionne une classe et une matière
 *   2. 4 onglets apparaissent (EF1, ES1, ES2, ES3)
 *   3. Pour chaque évaluation, il saisit les notes des élèves
 *   4. Export individuel (PDF) ou export groupé (ZIP de 4 PDFs)
 *
 * Backend: SaisieMasterService (table saisie_master_evaluations)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useModuleContext } from "@/hooks/useModuleContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen, Loader2, Users, Award, Download, FileArchive,
  RefreshCw, Send, Save, CheckCircle2, XCircle, Clock,
  AlertCircle, ClipboardCheck,
} from "lucide-react";

const EVALUATION_TYPES = [
  { code: "EF1", label: "Évaluation Formative 1", short: "EF1", color: "bg-blue-100 text-blue-700 border-blue-300", icon: BookOpen },
  { code: "ES1", label: "Évaluation Sommative 1", short: "ES1", color: "bg-purple-100 text-purple-700 border-purple-300", icon: Award },
  { code: "ES2", label: "Évaluation Sommative 2", short: "ES2", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Award },
  { code: "ES3", label: "Évaluation Sommative 3", short: "ES3", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: Award },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

const TRIMESTER_LABELS = ["", "1er Trimestre", "2e Trimestre", "3e Trimestre"];

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function SaisieMasterWorkspace() {
  const { tenant, user, academicYear } = useModuleContext();
  const teacherId = user?.teacherId || user?.id || '';

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTrimester, setSelectedTrimester] = useState<number>(1);
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});
  const [activeEval, setActiveEval] = useState<string>("EF1");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const allSubjects = classes.flatMap(c => c.subjects || []);

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement de l'année académique…
      </div>
    );
  }

  if (!teacherId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-foreground">Aucun profil enseignant trouvé</p>
      </div>
    );
  }

  // === Chargement des classes (réutilise l'API pedagogy-space) ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYear.id}`,
          { credentials: "include" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) setSelectedClassId(list[0].classId);
      } catch { setClasses([]); }
    })();
  }, [teacherId, academicYear.id]);

  // === Chargement des évaluations SaisieMaster ===
  const loadEvaluations = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId, academicYearId: academicYear.id, classId: selectedClassId,
        trimester: String(selectedTrimester),
      });
      const res = await fetch(
        `/api/saisiemaster/evaluations?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const map: Record<string, any> = {};
      for (const eval_ of list) {
        if (eval_.evaluationType) {
          map[eval_.evaluationType] = eval_;
        }
      }
      setEvaluations(map);
    } catch {
      setEvaluations({});
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYear.id, selectedClassId, selectedTrimester]);

  useEffect(() => {
    if (selectedClassId) loadEvaluations();
  }, [loadEvaluations, selectedClassId]);

  // === Créer ou récupérer une évaluation ===
  const getOrCreateEvaluation = async (evalType: string): Promise<any> => {
    const selectedClass = classes.find(c => c.classId === selectedClassId);
    const selectedSubject = allSubjects.find(s => s.subjectId === selectedSubjectId);
    const testTitle = `${EVALUATION_TYPES.find(t => t.code === evalType)?.label || evalType} - ${selectedClass?.className || ""} - T${selectedTrimester}`;

    const res = await fetch("/api/saisiemaster/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        academicYearId: academicYear.id, teacherId,
        classId: selectedClassId,
        subjectId: selectedSubjectId || null,
        evaluationType: evalType,
        evaluationLabel: EVALUATION_TYPES.find(t => t.code === evalType)?.label,
        testTitle,
        trimester: selectedTrimester,
        className: selectedClass?.className,
        subjectName: selectedSubject?.subjectName,
      }),
    });
    if (!res.ok) throw new Error("Erreur création");
    return res.json();
  };

  // === Export PDF individuel ===
  const handleExportPdf = async (eval_: any) => {
    if (!eval_) {
      toast.error("Veuillez d'abord créer l'évaluation");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(
        `/api/saisiemaster/evaluations/${eval_.id}/pdf`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${eval_.evaluationType}_${eval_.classNameResolved || "Classe"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("✅ PDF téléchargé");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setExporting(false);
    }
  };

  // === Export ZIP des 4 évaluations ===
  const handleExportZip = async () => {
    if (!selectedClassId) return;
    setExportingZip(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id, classId: selectedClassId,
        trimester: String(selectedTrimester),
      });
      if (selectedSubjectId) params.append("subjectId", selectedSubjectId);
      const res = await fetch(
        `/api/saisiemaster/evaluations/export-zip?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Erreur");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const selectedClass = classes.find(c => c.classId === selectedClassId);
      a.href = url;
      a.download = `Evaluations_SaisieMaster_${selectedClass?.className || "Classe"}_T${selectedTrimester}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("✅ ZIP téléchargé (4 PDFs)");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setExportingZip(false);
    }
  };

  const selectedClass = classes.find(c => c.classId === selectedClassId);
  const currentEval = evaluations[activeEval];
  const hasEvaluations = Object.keys(evaluations).length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* === En-tête : sélecteurs classe + matière + trimestre === */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Classe</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]">
              {classes.map(c => (
                <option key={c.classId} value={c.classId}>{c.className} ({c.totalStudents || 0} élèves)</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Matière</label>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]">
              <option value="">— Toutes les matières —</option>
              {allSubjects.map((s: any) => (
                <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Trimestre</label>
            <select value={selectedTrimester} onChange={(e) => setSelectedTrimester(parseInt(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[150px]">
              <option value={1}>1er Trimestre</option>
              <option value={2}>2e Trimestre</option>
              <option value={3}>3e Trimestre</option>
            </select>
          </div>

          <div className="flex-1" />

          <button onClick={loadEvaluations} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualiser
          </button>

          <button onClick={handleExportZip} disabled={exportingZip || !hasEvaluations}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
            {exportingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            Export ZIP (4 PDFs)
          </button>
        </div>
      </div>

      {/* === Sous-onglets : 4 types d'évaluations === */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {EVALUATION_TYPES.map(t => {
            const Icon = t.icon;
            const isActive = activeEval === t.code;
            const eval_ = evaluations[t.code];
            const hasNotes = eval_ && eval_.studentScores && (
              typeof eval_.studentScores === "string"
                ? JSON.parse(eval_.studentScores || "[]").length > 0
                : (eval_.studentScores || []).length > 0
            );
            return (
              <button
                key={t.code}
                onClick={() => setActiveEval(t.code)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all whitespace-nowrap border-b-2",
                  isActive
                    ? "text-blue-600 border-blue-600 bg-blue-50/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.short}</span>
                {eval_ && (
                  <span className={cn("ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                    eval_.status === "VALIDATED" ? "bg-emerald-100 text-emerald-700"
                    : eval_.status === "SUBMITTED" ? "bg-blue-100 text-blue-700"
                    : eval_.status === "REJECTED" ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600")}>
                    {hasNotes ? "●" : "○"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* === Contenu de l'évaluation active === */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {loading && !currentEval ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Chargement des évaluations…
          </div>
        ) : (
          <EvaluationEditor
            key={activeEval + selectedClassId + selectedSubjectId + selectedTrimester}
            evalType={activeEval}
            existingEval={currentEval}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            trimester={selectedTrimester}
            className={selectedClass?.className}
            teacherId={teacherId}
            academicYearId={academicYear.id}
            getOrCreate={getOrCreateEvaluation}
            onUpdated={loadEvaluations}
            onExportPdf={handleExportPdf}
            exporting={exporting}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EDITEUR D'UNE ÉVALUATION (EF1 / ES1 / ES2 / ES3)
// ============================================================================

function EvaluationEditor({
  evalType, existingEval, classId, subjectId, trimester, className, teacherId, academicYearId,
  getOrCreate, onUpdated, onExportPdf, exporting,
}: any) {
  const [eval_, setEval] = useState<any>(existingEval);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const evalConfig = EVALUATION_TYPES.find(t => t.code === evalType);

  useEffect(() => {
    if (existingEval) {
      setEval(existingEval);
      const sc = typeof existingEval.studentScores === "string"
        ? JSON.parse(existingEval.studentScores || "[]")
        : (existingEval.studentScores || []);
      setScores(sc);
      setStats(computeStats(sc, existingEval.maxScore || 20, existingEval.passingScore || 10));
    } else {
      setEval(null);
      setScores([]);
      setStats(null);
    }
  }, [existingEval]);

  const computeStats = (sc: any[], maxScore: number, passingScore: number) => {
    let total = 0, present = 0, absent = 0;
    let sum = 0, highest = -Infinity, lowest = Infinity;
    let passed = 0, failed = 0;
    let totalG = 0, totalF = 0, sumG = 0, sumF = 0, passedG = 0, passedF = 0;

    for (const s of sc) {
      total++;
      const sexe = (s.sexe || "").toUpperCase();
      if (sexe === "M" || sexe === "G") totalG++;
      else if (sexe === "F") totalF++;

      if (s.absent) { absent++; failed++; continue; }
      if (s.score === null || s.score === undefined || s.score === "") continue;
      present++;
      const score = parseFloat(s.score);
      if (isNaN(score)) continue;
      sum += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      const isPassed = score >= passingScore;
      if (isPassed) {
        passed++;
        if (sexe === "M" || sexe === "G") passedG++;
        else if (sexe === "F") passedF++;
      } else failed++;

      if (sexe === "M" || sexe === "G") sumG += score;
      else if (sexe === "F") sumF += score;
    }
    return {
      totalStudents: total, totalPresent: present, totalAbsent: absent,
      averageScore: present > 0 ? Math.round((sum / present) * 100) / 100 : 0,
      highestScore: highest === -Infinity ? 0 : highest,
      lowestScore: lowest === Infinity ? 0 : lowest,
      passedCount: passed, failedCount: failed,
      passRate: present > 0 ? Math.round((passed / present) * 10000) / 100 : 0,
      boysCount: totalG, girlsCount: totalF,
      boysAverage: totalG > 0 ? Math.round((sumG / totalG) * 100) / 100 : 0,
      girlsAverage: totalF > 0 ? Math.round((sumF / totalF) * 100) / 100 : 0,
      boysPassed: passedG, girlsPassed: passedF,
    };
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const created = await getOrCreate(evalType);
      setEval(created);
      setScores([]);
      toast.success(`✅ ${evalConfig?.label} créée`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInitStudents = async () => {
    if (!eval_) return;
    try {
      const res = await fetch(`/api/saisiemaster/evaluations/${eval_.id}/init-students`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      const updated = await res.json();
      setEval(updated);
      const sc = typeof updated.studentScores === "string"
        ? JSON.parse(updated.studentScores || "[]")
        : (updated.studentScores || []);
      setScores(sc);
      setStats(computeStats(sc, updated.maxScore || 20, updated.passingScore || 10));
      toast.success(`✅ ${sc.length} élèves chargés`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const updateScore = (idx: number, field: string, value: any) => {
    setScores(prev => {
      const newScores = [...prev];
      newScores[idx] = { ...newScores[idx], [field]: value };
      const newStats = computeStats(newScores, eval_?.maxScore || 20, eval_?.passingScore || 10);
      setStats(newStats);
      return newScores;
    });
  };

  const handleSave = async () => {
    if (!eval_) return;
    setSaving(true);
    try {
      const sc = computeStats(scores, eval_.maxScore || 20, eval_.passingScore || 10);
      const res = await fetch(`/api/saisiemaster/evaluations/${eval_.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentScores: scores,
          ...sc,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Notes enregistrées");
      onUpdated();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!eval_) return;
    if (!confirm(`Soumettre ${evalConfig?.label} au directeur ?`)) return;
    setSaving(true);
    try {
      const sc = computeStats(scores, eval_.maxScore || 20, eval_.passingScore || 10);
      await fetch(`/api/saisiemaster/evaluations/${eval_.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentScores: scores, ...sc }),
      });
      const res = await fetch(`/api/saisiemaster/evaluations/${eval_.id}/submit`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Évaluation soumise au directeur");
      onUpdated();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Création de l'évaluation…
      </div>
    );
  }

  if (!eval_) {
    return (
      <div className="text-center py-8">
        <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold mb-4", evalConfig?.color)}>
          {(() => { const Icon = evalConfig?.icon || BookOpen; return <Icon className="h-4 w-4" /> })()}
          {evalConfig?.label}
        </div>
        <p className="text-slate-600 mb-2">Cette évaluation n'a pas encore été créée pour cette classe et ce trimestre.</p>
        <p className="text-sm text-slate-500 mb-4">
          Classe: <strong>{className}</strong> · Trimestre: <strong>{TRIMESTER_LABELS[trimester]}</strong>
        </p>
        <button onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          <ClipboardCheck className="h-4 w-4" /> Créer l'évaluation
        </button>
      </div>
    );
  }

  const maxScore = eval_.maxScore || 20;
  const passingScore = eval_.passingScore || 10;
  const isReadOnly = eval_.status === "SUBMITTED" || eval_.status === "VALIDATED";
  const status = STATUS_CONFIG[eval_.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="space-y-4">
      {/* === En-tête de l'évaluation === */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2 py-0.5 rounded text-xs font-bold", evalConfig?.color)}>
              {evalConfig?.label}
            </span>
            {status && (
              <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold", status.color)}>
                <status.icon className="h-3 w-3" /> {status.label}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{eval_.testTitle}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Classe: <strong>{eval_.classNameResolved || className}</strong>
            {eval_.subjectName && <span> · Matière: <strong>{eval_.subjectName}</strong></span>}
            {eval_.testDate && <span> · Date: {formatDateFR(eval_.testDate)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onExportPdf(eval_)} disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            PDF
          </button>
          {eval_.status === "DRAFT" && (
            <button onClick={handleSubmit} disabled={saving || scores.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
              <Send className="h-3 w-3" /> Soumettre
            </button>
          )}
        </div>
      </div>

      {/* === Configuration === */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <div className="text-xs font-semibold text-slate-600">
          Sur <strong className="text-slate-900">{maxScore}</strong> · Seuil: <strong className="text-slate-900">{passingScore}</strong> · Coef: <strong className="text-slate-900">{eval_.coefficient ?? 1}</strong>
        </div>
        <div className="flex-1" />
        {scores.length === 0 && !isReadOnly && (
          <button onClick={handleInitStudents}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100">
            <Users className="h-3 w-3" /> Charger les élèves
          </button>
        )}
        {!isReadOnly && scores.length > 0 && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer
          </button>
        )}
      </div>

      {/* === Statistiques === */}
      {stats && scores.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <StatCard label="Effectif" value={stats.totalStudents} color="bg-slate-50 text-slate-700" />
          <StatCard label="Présents" value={stats.totalPresent} color="bg-emerald-50 text-emerald-700" />
          <StatCard label="Absents" value={stats.totalAbsent} color="bg-red-50 text-red-700" />
          <StatCard label="Moyenne" value={stats.averageScore?.toFixed(2) || "—"} color="bg-blue-50 text-blue-700" />
          <StatCard label="Note max" value={stats.highestScore?.toFixed(2) || "—"} color="bg-purple-50 text-purple-700" />
          <StatCard label="% réussite" value={`${stats.passRate}%`} color="bg-amber-50 text-amber-700" />
        </div>
      )}

      {/* === Tableau de saisie === */}
      {scores.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 px-2 py-2 w-12">N°</th>
                <th className="border border-slate-200 px-2 py-2 text-left" style={{ minWidth: "200px" }}>Nom et prénom</th>
                <th className="border border-slate-200 px-2 py-2 w-16">Sexe</th>
                <th className="border border-slate-200 px-2 py-2 w-32">Note /{maxScore}</th>
                <th className="border border-slate-200 px-2 py-2 w-24">Absent</th>
                <th className="border border-slate-200 px-2 py-2" style={{ minWidth: "150px" }}>Appréciation</th>
                <th className="border border-slate-200 px-2 py-2 w-16">Statut</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, idx) => {
                const score = parseFloat(s.score);
                const isPassed = !isNaN(score) && score >= passingScore;
                const isAbsent = s.absent;
                return (
                  <tr key={s.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                    <td className="border border-slate-200 px-2 py-1 text-center font-semibold">{s.numero || idx + 1}</td>
                    <td className="border border-slate-200 px-2 py-1 font-medium">{s.nom} {s.prenom}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{s.sexe}</td>
                    <td className="border border-slate-200 p-0">
                      <input type="number" step="0.25" min={0} max={maxScore}
                        value={s.score ?? ""}
                        onChange={(e) => updateScore(idx, "score", e.target.value)}
                        disabled={isReadOnly || isAbsent}
                        className={cn(
                          "w-full px-2 py-1 text-center text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent",
                          !isAbsent && isPassed && "text-emerald-700 font-bold",
                          !isAbsent && !isNaN(score) && !isPassed && "text-red-700 font-bold",
                          isAbsent && "opacity-40"
                        )} />
                    </td>
                    <td className="border border-slate-200 p-0 text-center">
                      <input type="checkbox" checked={!!s.absent}
                        onChange={(e) => updateScore(idx, "absent", e.target.checked)}
                        disabled={isReadOnly}
                        className="h-4 w-4" />
                    </td>
                    <td className="border border-slate-200 p-0">
                      <input type="text" value={s.appreciation || ""}
                        onChange={(e) => updateScore(idx, "appreciation", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="Très bien, Bien, Passable..."
                        className="w-full px-2 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {isAbsent ? (
                        <span className="text-xs text-slate-500">Absent</span>
                      ) : !isNaN(score) ? (
                        isPassed ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                : <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-slate-50 rounded-lg">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 mb-3">Aucun élève chargé</p>
          <button onClick={handleInitStudents}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
            <Users className="h-4 w-4" /> Charger les élèves inscrits
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="h-4 w-4" />
          Cette évaluation est verrouillée (statut: {eval_.status}). Vous ne pouvez plus la modifier.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className={cn("flex flex-col items-center p-2 rounded-lg border", color)}>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase font-semibold opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
