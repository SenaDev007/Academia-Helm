"use client";

/**
 * ============================================================================
 * CAHIER DE TEXTE (SECONDAIRE) — Journal de cours quotidien + Catalogue
 * ============================================================================
 *
 * ⭐ Refonte complète : le cahier de texte est maintenant un journal de cours.
 *
 * Chaque jour, l'enseignant du secondaire renseigne :
 *   - Titre du cours dispensé
 *   - Heure de début et heure de fin
 *   - Contenu du cours (RichTextEditor : gras, italique, couleurs, puces)
 *   - Matière + Classe
 *   - Date du cours
 *
 * Sous-onglets :
 *   1. Journal hebdomadaire  — vue grille 5 jours (Lun→Ven) avec saisie par jour
 *   2. Catalogue             — vue annuelle filtrable par trimestre / mois / semaine / jour
 *
 * Signature auto-attachée :
 *   - L'enseignant enregistre sa signature UNE FOIS via le bouton "Ma signature"
 *   - À chaque création d'entrée, le backend joint automatiquement :
 *     • teacherName (prénom + nom de l'enseignant)
 *     • teacherSignature (signature enregistrée)
 *     • className (résolu depuis la table classes)
 *
 * Visibilité :
 *   - Enseignants du secondaire UNIQUEMENT dans l'UI enseignant
 *   - Directeurs + Promoteurs voient tout (via PedagogicalSpaceWorkspace)
 *
 * Backend :
 *   GET    /api/pedagogy-space/cahier-textes?teacherId=&academicYearId=&classId=
 *   GET    /api/pedagogy-space/cahier-textes-catalogue?academicYearId=&trimester=&month=&weekStart=&dayDate=
 *   POST   /api/pedagogy-space/cahier-textes
 *   PUT    /api/pedagogy-space/cahier-textes/:id
 *   DELETE /api/pedagogy-space/cahier-textes/:id
 *   GET    /api/pedagogy-space/teacher-signature?userId=
 *   POST   /api/pedagogy-space/teacher-signature
 *   DELETE /api/pedagogy-space/teacher-signature?userId=
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, Plus, Save, Trash2, RefreshCw, Clock,
  ChevronDown, ChevronRight, BookOpen, Calendar, X, FileText,
  CalendarDays, ListTree, PenTool, CheckCircle2, Filter, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

// === Jours de la semaine ===
const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

const MONTHS = [
  { value: 0, label: "— Tous les mois —" },
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

const TRIMESTERS = [
  { value: 0, label: "— Tous les trimestres —" },
  { value: 1, label: "Trimestre 1" },
  { value: 2, label: "Trimestre 2" },
  { value: 3, label: "Trimestre 3" },
];

// === Helpers ===
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ⭐ Normaliser une valeur Date/chaîne en YYYY-MM-DD (UTC, sans décalage TZ)
function normalizeDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

interface CahierDeTexteTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function CahierDeTexteTab({ tenantId, academicYearId, teacherId }: CahierDeTexteTabProps) {
  const { academicYear } = useModuleContext();
  const { user } = useAppSession();
  const [activeSubTab, setActiveSubTab] = useState<"journal" | "catalogue">("journal");

  // === Signature de l'enseignant (auto-attach) ===
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [sigDrawing, setSigDrawing] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);

  const loadTeacherSignature = useCallback(async () => {
    if (!teacherId) return;
    try {
      const res = await fetch(
        `/api/pedagogy-space/teacher-signature?userId=${encodeURIComponent(teacherId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setTeacherSignature(data?.signatureUrl ?? null);
    } catch {
      setTeacherSignature(null);
    }
  }, [teacherId]);

  useEffect(() => { loadTeacherSignature(); }, [loadTeacherSignature]);

  const handleSaveSignature = async () => {
    if (!sigDrawing) {
      toast.error("Veuillez dessiner votre signature");
      return;
    }
    setSigSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/teacher-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: teacherId, signatureUrl: sigDrawing }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success("✅ Signature enregistrée");
      setTeacherSignature(sigDrawing);
      setShowSignatureModal(false);
      setSigDrawing(null);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSigSaving(false);
    }
  };

  const handleDeleteSignature = async () => {
    setSigSaving(true);
    try {
      await fetch(
        `/api/pedagogy-space/teacher-signature?userId=${encodeURIComponent(teacherId)}`,
        { method: "DELETE", credentials: "include" },
      );
      toast.success("Signature supprimée");
      setTeacherSignature(null);
      setShowSignatureModal(false);
      setSigDrawing(null);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSigSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* === En-tête : sous-onglets + bouton Ma signature === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveSubTab("journal")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
              activeSubTab === "journal"
                ? "bg-white shadow text-blue-700"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Journal hebdomadaire
          </button>
          <button
            onClick={() => setActiveSubTab("catalogue")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
              activeSubTab === "catalogue"
                ? "bg-white shadow text-blue-700"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <ListTree className="h-4 w-4" />
            Catalogue
          </button>
        </div>

        <button
          onClick={() => {
            setSigDrawing(null);
            setShowSignatureModal(true);
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-all",
            teacherSignature
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
          )}
          title="Enregistrer ou remplacer ma signature"
        >
          <PenTool className="h-4 w-4" />
          {teacherSignature ? "Ma signature" : "Définir ma signature"}
          {teacherSignature && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* === Sous-onglets === */}
      {activeSubTab === "journal" ? (
        <JournalHebdomadaire
          tenantId={tenantId}
          academicYearId={academicYearId}
          teacherId={teacherId}
          teacherSignature={teacherSignature}
          user={user}
        />
      ) : (
        <CatalogueView
          tenantId={tenantId}
          academicYearId={academicYearId}
          teacherId={teacherId}
        />
      )}

      {/* === MODAL : Signature de l'enseignant === */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-indigo-50 border-indigo-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PenTool className="h-10 w-10 text-indigo-600" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Ma signature</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cette signature sera automatiquement jointe à chaque entrée du cahier de texte.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {teacherSignature && !sigDrawing && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-700 uppercase mb-2">
                    Signature actuelle
                  </div>
                  <div className="border-2 border-emerald-300 bg-white rounded-xl p-2 flex items-center justify-center">
                    <img src={teacherSignature} alt="Signature actuelle" className="max-h-28" />
                  </div>
                  <button
                    onClick={() => setSigDrawing("__drawing__")}
                    className="mt-3 text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    Remplacer par une nouvelle signature
                  </button>
                </div>
              )}

              {(!teacherSignature || sigDrawing === "__drawing__") && (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                    Dessinez votre signature ci-dessous
                  </label>
                  <SignatureCanvas
                    width={500}
                    height={180}
                    placeholder="Signez ici avec votre souris ou doigt"
                    onSignatureChange={(data) => setSigDrawing(data)}
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
              <div>
                {teacherSignature && (
                  <button
                    onClick={handleDeleteSignature}
                    disabled={sigSaving}
                    className="text-xs text-rose-600 hover:underline font-semibold"
                  >
                    Supprimer ma signature
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowSignatureModal(false); setSigDrawing(null); }}
                  disabled={sigSaving}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  Annuler
                </button>
                {sigDrawing && sigDrawing !== "__drawing__" && (
                  <button
                    onClick={handleSaveSignature}
                    disabled={sigSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {sigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer ma signature
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SOUS-ONGLET 1 : JOURNAL HEBDOMADAIRE
// ============================================================================

interface JournalHebdomadaireProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  teacherSignature: string | null;
  user: any;
}

function JournalHebdomadaire({
  tenantId, academicYearId, teacherId, teacherSignature, user,
}: JournalHebdomadaireProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [weekStart, setWeekStart] = useState(formatDate(getMonday(new Date())));
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForDay, setCreateForDay] = useState<string>("");
  const [formData, setFormData] = useState({
    courseTitle: "",
    subjectId: "",
    startTime: "08:00",
    endTime: "10:00",
    content: "",
  });

  // === Charger les classes assignées ===
  const loadClasses = useCallback(async () => {
    if (!teacherId || !academicYearId) return;
    try {
      const res = await fetch(
        `/api/pedagogy-space/my-classes?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setClasses(arr);
      if (arr.length > 0 && !selectedClassId) {
        setSelectedClassId(arr[0].classId);
      }
    } catch {
      setClasses([]);
    }
  }, [teacherId, academicYearId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // === Charger les entrées du cahier de texte pour la semaine ===
  const loadEntries = useCallback(async () => {
    if (!selectedClassId || !academicYearId || !teacherId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId: selectedClassId,
      });
      const res = await fetch(
        `/api/pedagogy-space/cahier-textes?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, selectedClassId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // === Navigation entre semaines ===
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 4);
  const prevWeek = formatDate(new Date(weekStartDate.getTime() - 7 * 86400000));
  const nextWeek = formatDate(new Date(weekStartDate.getTime() + 7 * 86400000));

  // === Filtrer les entrées par jour ===
  const getEntriesForDay = (dayKey: string) => {
    const dayDate = new Date(weekStartDate);
    const dayIdx = DAYS.findIndex(d => d.key === dayKey);
    dayDate.setDate(dayDate.getDate() + dayIdx);
    const dayDateStr = formatDate(dayDate);
    return entries.filter(e => {
      const eDate = normalizeDate(e.lessonDate ?? e.testDate);
      return eDate === dayDateStr;
    });
  };

  // === Créer une entrée ===
  const handleCreate = async () => {
    if (!formData.courseTitle.trim() || !formData.startTime || !formData.endTime) {
      toast.error("Titre du cours, heure de début et heure de fin sont obligatoires");
      return;
    }
    setSaving(true);
    try {
      const dayDate = new Date(weekStartDate);
      const dayIdx = DAYS.findIndex(d => d.key === createForDay);
      dayDate.setDate(dayDate.getDate() + dayIdx);

      const selectedClass = classes.find(c => c.classId === selectedClassId);
      const res = await fetch("/api/pedagogy-space/cahier-textes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId,
          teacherId,
          classId: selectedClassId,
          subjectId: formData.subjectId || undefined,
          className: selectedClass?.className || undefined,
          // ⭐ Le teacherName + teacherSignature sont auto-attachés par le backend
          //    (lus depuis la table teachers). Le frontend n'a plus besoin de les envoyer.
          trimester: 1,
          testType: "JOURNAL",
          testTitle: formData.courseTitle,
          testNumber: 1,
          courseTitle: formData.courseTitle,
          startTime: formData.startTime,
          endTime: formData.endTime,
          content: formData.content,
          lessonDate: formatDate(dayDate),
          testDate: formatDate(dayDate),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur");
      }
      toast.success("✅ Cours enregistré");
      setShowCreateModal(false);
      setFormData({ courseTitle: "", subjectId: "", startTime: "08:00", endTime: "10:00", content: "" });
      loadEntries();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Supprimer une entrée ===
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetch(`/api/pedagogy-space/cahier-textes/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Cours supprimé");
      setDeleteTarget(null);
      loadEntries();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Modifier le contenu d'une entrée ===
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditContent(entry.content || "");
    setEditCourseTitle(entry.courseTitle || entry.testTitle || "");
    setEditStartTime(entry.startTime || "");
    setEditEndTime(entry.endTime || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-textes/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseTitle: editCourseTitle,
          startTime: editStartTime,
          endTime: editEndTime,
          content: editContent,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Cours modifié");
      setEditingId(null);
      loadEntries();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const selectedClass = useMemo(
    () => classes.find(c => c.classId === selectedClassId),
    [classes, selectedClassId],
  );
  const availableSubjects = selectedClass?.subjects || [];

  const dayEntries = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const day of DAYS) {
      map[day.key] = getEntriesForDay(day.key);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, weekStart]);

  if (classes.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune classe assignée</p>
        <p className="text-xs text-slate-400 mt-1">
          Le cahier de texte nécessite au moins une classe assignée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* === En-tête : classe + semaine + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
            disabled={loading}
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId} ({c.totalStudents || 0} élèves)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(prevWeek)}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">
            ←
          </button>
          <div className="text-center px-3">
            <div className="text-sm font-bold text-slate-900">
              Semaine du {formatDateFR(weekStart)}
            </div>
            <div className="text-xs text-slate-500">
              au {formatDateFR(formatDate(weekEndDate))}
            </div>
          </div>
          <button onClick={() => setWeekStart(nextWeek)}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">
            →
          </button>
        </div>

        <button onClick={loadEntries}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
          title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Signature indicator */}
        {teacherSignature && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Signature auto-jointe</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day) => {
            const dayDate = new Date(weekStartDate);
            dayDate.setDate(dayDate.getDate() + (day.id - 1));
            const dayEntriesList = dayEntries[day.key] || [];
            const isExpanded = expandedDay === day.key;

            return (
              <div key={day.key}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100"
                  onClick={() => setExpandedDay(isExpanded ? null : day.key)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <span className="font-bold text-slate-900 text-sm">{day.label}</span>
                    <span className="text-xs text-slate-400">
                      {dayDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </span>
                    {dayEntriesList.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                        {dayEntriesList.length} cours
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateForDay(day.key);
                      setFormData({ courseTitle: "", subjectId: "", startTime: "08:00", endTime: "10:00", content: "" });
                      setShowCreateModal(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter un cours
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {dayEntriesList.length === 0 ? (
                      <div className="text-center py-6 text-slate-400">
                        <Calendar className="h-8 w-8 mx-auto text-slate-200 mb-2" />
                        <p className="text-xs">Aucun cours enregistré pour ce jour.</p>
                        <p className="text-[10px] mt-1">Cliquez sur "Ajouter un cours" pour commencer.</p>
                      </div>
                    ) : (
                      dayEntriesList.map((entry) => (
                        <div key={entry.id}
                          className="border border-slate-200 rounded-lg overflow-hidden">
                          {editingId === entry.id ? (
                            <div className="p-4 space-y-3 bg-blue-50/30">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Titre du cours *</label>
                                  <input type="text" value={editCourseTitle}
                                    onChange={e => setEditCourseTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Heure début</label>
                                  <input type="time" value={editStartTime}
                                    onChange={e => setEditStartTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Heure fin</label>
                                  <input type="time" value={editEndTime}
                                    onChange={e => setEditEndTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Contenu du cours</label>
                                <RichTextEditor value={editContent}
                                  onChange={html => setEditContent(html)}
                                  minHeight="120px" />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingId(null)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">
                                  Annuler
                                </button>
                                <button onClick={handleSaveEdit} disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-900 text-sm">
                                    {entry.courseTitle || entry.testTitle || "Sans titre"}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    {entry.startTime && entry.endTime && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {entry.startTime} → {entry.endTime}
                                      </span>
                                    )}
                                    {entry.subjectName && (
                                      <span className="font-medium text-slate-600">
                                        {entry.subjectName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => startEdit(entry)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Modifier">
                                    <FileText className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setDeleteTarget(entry)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Supprimer">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              {entry.content && (
                                <div className="mt-2 text-sm text-slate-700 prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: entry.content }} />
                              )}
                              {/* ⭐ Afficher la signature + nom enseignant auto-joints */}
                              {(entry.teacherSignature || entry.teacherSignatureUrl || entry.teacherFullName) && (
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-end gap-3">
                                  <div className="text-right">
                                    {entry.teacherFullName && (
                                      <div className="text-xs font-bold text-slate-700">
                                        {entry.teacherFullName}
                                      </div>
                                    )}
                                    {entry.classNameResolved && (
                                      <div className="text-[10px] text-slate-500">
                                        {entry.classNameResolved}
                                      </div>
                                    )}
                                  </div>
                                  {(entry.teacherSignature || entry.teacherSignatureUrl) && (
                                    <div className="border-b border-slate-400 pb-0.5">
                                      <img
                                        src={entry.teacherSignature || entry.teacherSignatureUrl}
                                        alt="Signature"
                                        className="max-h-12"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* === MODAL : Créer un cours === */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-10 w-10 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Nouveau cours</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {DAYS.find(d => d.key === createForDay)?.label} — {formatDateFR(weekStart)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Titre du cours *</label>
                <input type="text" value={formData.courseTitle}
                  onChange={e => setFormData({ ...formData, courseTitle: e.target.value })}
                  placeholder="Ex: Chapitre 3 — Les équations du second degré"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Matière</label>
                  <select value={formData.subjectId}
                    onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">— Générale —</option>
                    {availableSubjects.map((s: any) => {
                      const sid = s.subjectId || s.id;
                      const sname = s.subjectName || s.name || s.subjectCode || s.code;
                      return <option key={sid} value={sid}>{sname}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Heure début *</label>
                  <input type="time" value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Heure fin *</label>
                  <input type="time" value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
                  Contenu du cours (chapitres, notions abordées, exercices...)
                </label>
                <RichTextEditor value={formData.content}
                  onChange={html => setFormData({ ...formData, content: html })}
                  minHeight="160px" />
              </div>
              {/* ⭐ Aperçu de l'auto-attach signature */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-emerald-800">
                  <div className="font-bold">Auto-attach : nom + signature</div>
                  <div className="text-emerald-700">
                    Votre nom et signature seront automatiquement joints à ce cours.
                  </div>
                </div>
                {teacherSignature && (
                  <img src={teacherSignature} alt="Signature" className="max-h-10 ml-auto" />
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setShowCreateModal(false)} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving || !formData.courseTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer le cours
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL : Confirmation de suppression === */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <div className="flex items-center gap-3">
                <Trash2 className="h-10 w-10 text-rose-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Supprimer le cours</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.courseTitle || deleteTarget.testTitle}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700">
                Vous êtes sur le point de supprimer définitivement ce cours du cahier de texte.
                Cette action est irréversible.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button onClick={() => setDeleteTarget(null)} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
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

// ============================================================================
// SOUS-ONGLET 2 : CATALOGUE (vue annuelle filtrable)
// ============================================================================

interface CatalogueViewProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

function CatalogueView({ tenantId, academicYearId, teacherId }: CatalogueViewProps) {
  const [trimester, setTrimester] = useState<number>(0);
  const [month, setMonth] = useState<number>(0);
  const [weekStart, setWeekStart] = useState<string>("");
  const [dayDate, setDayDate] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  // === Charger les classes (pour le filtre) ===
  useEffect(() => {
    if (!teacherId || !academicYearId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
          { credentials: "include" },
        );
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch {
        setClasses([]);
      }
    })();
  }, [teacherId, academicYearId]);

  // === Charger les entrées du catalogue ===
  const loadCatalogue = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId });
      if (teacherId) params.append("teacherId", teacherId);
      if (classFilter) params.append("classId", classFilter);
      if (trimester > 0) params.append("trimester", String(trimester));
      if (month > 0) params.append("month", String(month));
      if (weekStart) params.append("weekStart", weekStart);
      if (dayDate) params.append("dayDate", dayDate);

      const res = await fetch(
        `/api/pedagogy-space/cahier-textes-catalogue?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, classFilter, trimester, month, weekStart, dayDate]);

  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);

  // === Groupé par jour ===
  const groupedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of entries) {
      const key = normalizeDate(e.lessonDate ?? e.testDate) ?? "_no_date";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  // === Navigation rapide entre semaines ===
  const currentWeekMonday = useMemo(() => {
    if (weekStart) return weekStart;
    return formatDate(getMonday(new Date()));
  }, [weekStart]);

  const shiftWeek = (delta: number) => {
    const d = new Date(currentWeekMonday + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(formatDate(d));
    setDayDate("");
    setTrimester(0);
    setMonth(0);
  };

  const resetFilters = () => {
    setTrimester(0);
    setMonth(0);
    setWeekStart("");
    setDayDate("");
    setClassFilter("");
  };

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="h-4 w-4" />
          Filtres du catalogue
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Classe</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className || c.classId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Trimestre</label>
            <select
              value={trimester}
              onChange={(e) => setTrimester(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {TRIMESTERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mois</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Semaine du</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => { setWeekStart(e.target.value); setTrimester(0); setMonth(0); setDayDate(""); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Jour précis</label>
            <input
              type="date"
              value={dayDate}
              onChange={(e) => { setDayDate(e.target.value); setWeekStart(""); setTrimester(0); setMonth(0); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCatalogue}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Réinitialiser
          </button>
          {weekStart && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => shiftWeek(-1)}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700">
                Semaine du {formatDateFR(weekStart)}
              </span>
              <button onClick={() => shiftWeek(1)}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === Stats === */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <span>
          <strong className="text-slate-900">{entries.length}</strong> entrée{entries.length > 1 ? "s" : ""} trouvée{entries.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* === Contenu === */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune entrée trouvée pour ces filtres</p>
          <p className="text-xs text-slate-400 mt-1">
            Modifiez les filtres ou créez un nouveau cours depuis le Journal hebdomadaire.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map(([dayKey, dayEntries]) => (
            <div key={dayKey} className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {dayKey === "_no_date" ? "Sans date" : formatDateLong(dayKey)}
                </h3>
                <span className="text-xs text-slate-400">· {dayEntries.length} cours</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {dayEntries.map((entry) => {
                  const sig = entry.teacherSignature || entry.teacherSignatureUrl;
                  const teacherName = entry.teacherFullName || entry.teacherName;
                  const className = entry.classNameResolved || entry.className;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      {/* En-tête */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {entry.courseTitle || entry.testTitle || "Sans titre"}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {entry.startTime && entry.endTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {entry.startTime} → {entry.endTime}
                              </span>
                            )}
                            {entry.subjectName && (
                              <span className="font-medium text-slate-600">
                                {entry.subjectName}
                              </span>
                            )}
                            {className && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                                {className}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Contenu */}
                      {entry.content && (
                        <div className="mt-2 text-xs text-slate-700 prose prose-sm max-w-none line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: entry.content }} />
                      )}
                      {/* ⭐ Auto-attach : nom + classe + signature */}
                      {(teacherName || sig) && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                          <div className="text-[10px] text-slate-500">
                            {teacherName && (
                              <div className="font-bold text-slate-700 text-xs">{teacherName}</div>
                            )}
                            {className && <div>Classe : {className}</div>}
                          </div>
                          {sig && (
                            <div className="border-b border-slate-400 pb-0.5">
                              <img src={sig} alt="Signature" className="max-h-10" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === MODAL : Détail d'une entrée === */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b bg-blue-50 border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedEntry.courseTitle || selectedEntry.testTitle || "Sans titre"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedEntry.lessonDate ? formatDateLong(selectedEntry.lessonDate) : ""}
                    {selectedEntry.startTime && selectedEntry.endTime
                      ? ` · ${selectedEntry.startTime} → ${selectedEntry.endTime}` : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedEntry(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Métadonnées */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Classe</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedEntry.classNameResolved || selectedEntry.className || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Matière</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedEntry.subjectName || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Trimestre</div>
                  <div className="text-sm font-semibold text-slate-900">
                    T{selectedEntry.trimester || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Enseignant</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {selectedEntry.teacherFullName || selectedEntry.teacherName || "—"}
                  </div>
                </div>
              </div>
              {/* Contenu */}
              {selectedEntry.content && (
                <div>
                  <div className="text-xs font-bold text-slate-600 uppercase mb-2">Contenu du cours</div>
                  <div className="text-sm text-slate-700 prose prose-sm max-w-none border border-slate-200 rounded-lg p-3"
                    dangerouslySetInnerHTML={{ __html: selectedEntry.content }} />
                </div>
              )}
              {/* ⭐ Section signature */}
              {(selectedEntry.teacherFullName || selectedEntry.teacherSignature || selectedEntry.teacherSignatureUrl) && (
                <div className="pt-4 border-t-2 border-slate-200">
                  <div className="text-xs font-bold text-slate-600 uppercase mb-3">Signature</div>
                  <div className="flex items-end justify-end gap-6">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {selectedEntry.teacherFullName || selectedEntry.teacherName}
                      </div>
                      <div className="text-xs text-slate-500">
                        Enseignant{selectedEntry.classNameResolved ? ` — ${selectedEntry.classNameResolved}` : ""}
                      </div>
                    </div>
                    {(selectedEntry.teacherSignature || selectedEntry.teacherSignatureUrl) && (
                      <div className="border-b-2 border-slate-700 pb-1">
                        <img
                          src={selectedEntry.teacherSignature || selectedEntry.teacherSignatureUrl}
                          alt="Signature enseignant"
                          className="max-h-20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
