"use client";

/**
 * ============================================================================
 * CAHIER DE TEXTE (SECONDAIRE) — Journal de cours quotidien
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
 * Visibilité :
 *   - Enseignants du secondaire UNIQUEMENT dans l'UI enseignant
 *   - Directeurs + Promoteurs voient tout (via PedagogicalSpaceWorkspace)
 *
 * Backend :
 *   GET    /api/pedagogy-space/cahier-textes?teacherId=&academicYearId=&classId=
 *   POST   /api/pedagogy-space/cahier-textes
 *   PUT    /api/pedagogy-space/cahier-textes/:id
 *   DELETE /api/pedagogy-space/cahier-textes/:id
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, Plus, Save, Trash2, RefreshCw, Clock,
  ChevronDown, ChevronRight, BookOpen, Calendar, X, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
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

// === Helpers ===
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [weekStart, setWeekStart] = useState(formatDate(getMonday(new Date())));
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  // ⭐ Modal de création d'entrée
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
        { credentials: "include" }
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
        { credentials: "include" }
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
      const eDate = e.lessonDate ? new Date(e.lessonDate).toISOString().split("T")[0] : null;
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
          teacherName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
          trimester: 1, // Auto-calculé depuis la semaine
          testType: "JOURNAL", // Nouveau type pour le journal de cours
          testTitle: formData.courseTitle, // Réutiliser testTitle
          testNumber: 1,
          // ⭐ Nouveaux champs (refonte)
          courseTitle: formData.courseTitle,
          startTime: formData.startTime,
          endTime: formData.endTime,
          content: formData.content,
          lessonDate: formatDate(dayDate),
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

  // === Modifier le contenu d'une entrée (inline edit) ===
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

  // === Sujets disponibles pour la classe sélectionnée ===
  const selectedClass = useMemo(
    () => classes.find(c => c.classId === selectedClassId),
    [classes, selectedClassId]
  );
  const availableSubjects = selectedClass?.subjects || [];

  // === Groupé par jour ===
  const dayEntries = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const day of DAYS) {
      map[day.key] = getEntriesForDay(day.key);
    }
    return map;
  }, [entries, weekStart]);

  if (classes.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune classe assignée</p>
        <p className="text-xs text-slate-400 mt-1">Le cahier de texte nécessite au moins une classe assignée.</p>
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

        {/* Navigation semaines */}
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* === Grille 5 jours === */}
          {DAYS.map((day) => {
            const dayDate = new Date(weekStartDate);
            dayDate.setDate(dayDate.getDate() + (day.id - 1));
            const dayEntriesList = dayEntries[day.key] || [];
            const isExpanded = expandedDay === day.key;

            return (
              <div key={day.key}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* En-tête jour */}
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

                {/* Contenu du jour */}
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
                            /* === MODE ÉDITION === */
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
                            /* === MODE LECTURE === */
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
                              {/* Contenu du cours (HTML riche) */}
                              {entry.content && (
                                <div className="mt-2 text-sm text-slate-700 prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: entry.content }} />
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
              <div className="flex items-center gap-3">
                <BookOpen className="h-10 w-10 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Nouveau cours</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {DAYS.find(d => d.key === createForDay)?.label} — {formatDateFR(weekStart)}
                  </p>
                </div>
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
