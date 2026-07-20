"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Loader2, Plus, Save, RefreshCw, ChevronRight, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

interface HomeworkTabProps {
  tenantId: string;
  academicYearId: string;
  schoolLevelId: string;
  teacherId: string;
}

const TASK_STATUSES = [
  { value: "PENDING", label: "En attente", color: "bg-slate-100 text-slate-600" },
  { value: "DONE", label: "Fait", color: "bg-emerald-100 text-emerald-700" },
  { value: "NOT_DONE", label: "Non fait", color: "bg-red-100 text-red-700" },
  { value: "INCOMPLETE", label: "Incomplet", color: "bg-amber-100 text-amber-700" },
  { value: "LATE", label: "En retard", color: "bg-orange-100 text-orange-700" },
  { value: "TO_REDO", label: "À reprendre", color: "bg-purple-100 text-purple-700" },
];

export function HomeworkTab({ tenantId, academicYearId, schoolLevelId, teacherId }: HomeworkTabProps) {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: "", subjectId: "", title: "", description: "", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0], maxScore: "" });
  const [selectedHomework, setSelectedHomework] = useState<any | null>(null);
  const [taskStudents, setTaskStudents] = useState<any[]>([]);

  const loadHomeworks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/homeworks?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setHomeworks(Array.isArray(data) ? data : []);
    } catch { setHomeworks([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId]);

  useEffect(() => {
    loadHomeworks();
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, [loadHomeworks, teacherId, academicYearId]);

  const handleCreate = async () => {
    if (!form.classId || !form.title || !form.description) { toast.error("Champs obligatoires manquants"); return; }
    try {
      const res = await fetch("/api/pedagogy-space/homeworks", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, academicYearId, schoolLevelId, teacherId, maxScore: form.maxScore ? Number(form.maxScore) : undefined }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Devoir créé");
      setShowForm(false);
      setForm({ classId: "", subjectId: "", title: "", description: "", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0], maxScore: "" });
      loadHomeworks();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const loadTaskStudents = async (hwId: string) => {
    try {
      const res = await fetch(`/api/pedagogy-space/homeworks/${hwId}/students`, { credentials: "include" });
      const data = await res.json();
      setTaskStudents(Array.isArray(data) ? data : []);
    } catch { setTaskStudents([]); }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await fetch(`/api/pedagogy-space/task-students/${taskId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status }),
      });
      setTaskStudents(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  // Vue détail (suivi par élève)
  if (selectedHomework) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedHomework(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{selectedHomework.title}</h3>
            <p className="text-sm text-slate-500">{selectedHomework.class?.name} — Échéance: {new Date(selectedHomework.dueDate).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">{selectedHomework.totalStudents} élèves</span>
          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">{selectedHomework.done} Faits</span>
          <span className="px-3 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold">{selectedHomework.notDone} Non faits</span>
          <span className="px-3 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold">{selectedHomework.pending} En attente</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 font-semibold text-slate-700">N°</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Élève</th>
              <th className="text-center px-4 py-2 font-semibold text-slate-700">Statut</th>
            </tr></thead>
            <tbody>
              {taskStudents.map((t, idx) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{t.student?.lastName} {t.student?.firstName}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {TASK_STATUSES.map(ts => (
                        <button key={ts.value} onClick={() => updateTaskStatus(t.id, ts.value)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                            t.status === ts.value ? ts.color : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                          )}>
                          {ts.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Vue liste
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Devoirs & Activités</h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nouveau devoir
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm">
            <option value="">— Classe —</option>
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm">
            <option value="">— Matière (optionnel) —</option>
            {classes.find(c => c.classId === form.classId)?.subjects?.map((s: any) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
          </select>
          <input type="text" placeholder="Titre *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          <textarea placeholder="Description / consigne *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
            <input type="number" placeholder="Note max" value={form.maxScore} onChange={e => setForm({ ...form, maxScore: e.target.value })} className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          </div>
          <button onClick={handleCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Save className="h-4 w-4" /> Créer
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Aucun devoir créé.</div>
      ) : (
        <div className="space-y-3">
          {homeworks.map(hw => (
            <button key={hw.id} onClick={() => { setSelectedHomework(hw); loadTaskStudents(hw.id); }}
              className="w-full text-left flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all">
              <div>
                <p className="font-medium text-slate-900">{hw.title}</p>
                <p className="text-xs text-slate-500">{hw.class?.name} — Échéance: {new Date(hw.dueDate).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">{hw.done}/{hw.totalStudents}</span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(" "); }
