"use client";

/**
 * Teacher Tasks — Travaux & Suivi
 * Connecté au backend (pas de données mock).
 * Responsive avec scroll vertical.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  ClipboardList, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function TeacherTasksPage() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const teacherId = user?.id || "";

  const loadTasks = useCallback(async () => {
    if (!academicYear?.id || !teacherId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/homeworks?teacherId=${teacherId}&academicYearId=${academicYear.id}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYear?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">Travaux & Suivi</h2>
        </div>
        <button
          onClick={loadTasks}
          disabled={loading}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Aucun devoir ou tâche assigné pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 truncate">{task.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{task.description}</p>
                </div>
                <span className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold ${
                  task.status === "DONE" ? "bg-emerald-100 text-emerald-700"
                  : task.status === "LATE" ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600"
                }`}>
                  {task.status === "DONE" ? "Fait" : task.status === "LATE" ? "En retard" : "En cours"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  À rendre le {formatDate(task.dueDate)}
                </span>
                {task.class?.name && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {task.class.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {task.done || 0}/{task.totalStudents || 0} élèves
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
