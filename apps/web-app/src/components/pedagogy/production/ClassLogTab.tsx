"use client";

import { useState, useEffect, useCallback } from "react";
import { NotebookPen, Loader2, Plus, Save, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

interface ClassLogTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function ClassLogTab({ tenantId, academicYearId, teacherId }: ClassLogTabProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classId: "", subjectId: "", lessonDate: new Date().toISOString().split("T")[0], topic: "", durationHours: 1, homework: "", detailedContent: "", observations: "" });
  const [classes, setClasses] = useState<any[]>([]);
  // ⭐ Matières filtrées dynamiquement par classe sélectionnée (appel API)
  const [subjectsForClass, setSubjectsForClass] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/class-logs?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId]);

  useEffect(() => {
    loadLogs();
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, [loadLogs, teacherId, academicYearId]);

  // ⭐ Quand l'utilisateur sélectionne une classe dans le formulaire,
  // charger dynamiquement les matières de CETTE classe via /subjects/available.
  // On ne peut pas se fier à c.subjects (souvent vide car class_subjects.classId
  // est null en base — les matières sont rattachées via academicClassId).
  useEffect(() => {
    if (!form.classId) {
      setSubjectsForClass([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSubjects(true);
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${form.classId}&teacherId=${teacherId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!cancelled) {
          setSubjectsForClass(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setSubjectsForClass([]);
      } finally {
        if (!cancelled) setLoadingSubjects(false);
      }
    })();
    // Reset subjectId when class changes
    setForm(prev => ({ ...prev, subjectId: "" }));
    return () => { cancelled = true; };
  }, [form.classId, academicYearId, teacherId]);

  const handleCreate = async () => {
    if (!form.classId || !form.subjectId || !form.topic) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    try {
      const res = await fetch("/api/pedagogy-space/class-logs", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, academicYearId, teacherId }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Séance enregistrée");
      setShowForm(false);
      setForm({ classId: "", subjectId: "", lessonDate: new Date().toISOString().split("T")[0], topic: "", durationHours: 1, homework: "", detailedContent: "", observations: "" });
      loadLogs();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Cahier Journal</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nouvelle séance
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm">
              <option value="">— Classe —</option>
              {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select>
            <select
              value={form.subjectId}
              onChange={e => setForm({ ...form, subjectId: e.target.value })}
              disabled={!form.classId || loadingSubjects}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">
                {loadingSubjects
                  ? "Chargement des matières…"
                  : !form.classId
                    ? "— Sélectionnez une classe —"
                    : subjectsForClass.length === 0
                      ? "— Aucune matière pour cette classe —"
                      : "— Matière —"}
              </option>
              {subjectsForClass.map((s: any) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectName}{s.subjectCode ? ` (${s.subjectCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <input type="date" value={form.lessonDate} onChange={e => setForm({ ...form, lessonDate: e.target.value })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          <input type="text" placeholder="Sujet de la leçon *" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="number" min="1" placeholder="Durée (h)" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: Number(e.target.value) })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
            <input type="text" placeholder="Devoir maison" value={form.homework} onChange={e => setForm({ ...form, homework: e.target.value })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          </div>
          <textarea placeholder="Contenu détaillé" value={form.detailedContent} onChange={e => setForm({ ...form, detailedContent: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <textarea placeholder="Observations" value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <button onClick={handleCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Aucune séance enregistrée.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Date</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Classe</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Matière</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Sujet</th>
              <th className="text-center px-4 py-2 font-semibold text-slate-700">Durée</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Devoir</th>
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-500">{new Date(l.lessonDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{l.class?.name || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{l.subject?.name || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{l.topic}</td>
                  <td className="px-4 py-2 text-center text-slate-500">{l.durationHours}h</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{l.homework || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
