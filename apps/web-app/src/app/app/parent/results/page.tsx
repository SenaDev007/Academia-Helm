"use client";

/**
 * Parent Portal — Bulletins / Résultats
 * Notes et appréciations de l'enfant.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { FileText, Loader2 } from "lucide-react";

export default function ParentResultsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  const loadResults = useCallback(async () => {
    if (!selectedStudent || !academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/results/${selectedStudent}?academicYearId=${academicYear.id}`, { credentials: "include" });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [selectedStudent, academicYear?.id]);

  useEffect(() => {
    if (selectedStudent) loadResults();
  }, [loadResults, selectedStudent]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-bold text-slate-900">Bulletins & Résultats</h2>
      </div>

      {children.length > 1 && (
        <select
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : results.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Matière</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Note</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Sur</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Appréciation</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Période</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.subject || "—"}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{r.score ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{r.maxScore || 20}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.appreciation || "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-500 text-xs">{r.period || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun résultat disponible pour cette période.</p>
          <p className="text-xs text-slate-400 mt-1">Les bulletins seront publiés par l'école après les compositions.</p>
        </div>
      )}
    </div>
  );
}
