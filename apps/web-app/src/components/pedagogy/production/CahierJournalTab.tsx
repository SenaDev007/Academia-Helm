"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL — Grille hebdomadaire (5 jours × matières dynamiques)
 * ============================================================================
 *
 * Template officiel du primaire/maternelle.
 * Format paysage : 2 pages (recto + verso).
 * Les matières sont récupérées DYNAMIQUEMENT depuis la base de données
 * selon ce que l'école a configuré (table class_subjects / subjects).
 * Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  NotebookPen, Loader2, Save, RefreshCw, Send, Lock, Calendar,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

interface CahierJournalTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// === CONSTANTES DU TEMPLATE OFFICIEL ===

const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

// Helper pour parser les entries JSON
function parseEntries(entries: any): Record<string, Record<string, string>> {
  if (!entries) return {};
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return {}; }
  }
  return entries as Record<string, Record<string, string>>;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Calcul du lundi de la semaine pour une date donnée
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = day === 0 ? -6 : 1 - day; // reculer au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CahierJournalTab({ tenantId, academicYearId, teacherId }: CahierJournalTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfWeek(new Date()));
  const [journal, setJournal] = useState<any>(null);
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>({});
  const [observations, setObservations] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Matières dynamiques chargées depuis la base de données
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);

  // === Chargement des classes + matières ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].classId);
        }
      } catch {
        setClasses([]);
      }
    })();
  }, [teacherId, academicYearId]);

  // === Chargement des matières disponibles pour la classe sélectionnée ===
  useEffect(() => {
    if (!selectedClassId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${selectedClassId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setDynamicSubjects(Array.isArray(data) ? data : []);
      } catch {
        setDynamicSubjects([]);
      }
    })();
  }, [selectedClassId, academicYearId]);

  // Répartir les matières en 2 pages (recto = première moitié, verso = seconde moitié)
  const RECTO_SUBJECTS = dynamicSubjects.slice(0, Math.ceil(dynamicSubjects.length / 2));
  const VERSO_SUBJECTS = dynamicSubjects.slice(Math.ceil(dynamicSubjects.length / 2));

  // === Chargement du cahier journal ===
  const loadJournal = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pedagogy-space/cahier-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, teacherId, classId: selectedClassId,
          weekStartDate: formatDate(weekStart),
          className: classes.find(c => c.classId === selectedClassId)?.className || "",
        }),
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setJournal(data);
      setEntries(parseEntries(data.entries));
      setObservations(data.observations || "");
      setDirectorName(data.directorName || "");
    } catch (e: any) {
      toast.error("Erreur lors du chargement", { description: e.message });
      setJournal(null);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, selectedClassId, weekStart, classes]);

  useEffect(() => {
    if (selectedClassId) loadJournal();
  }, [loadJournal, selectedClassId]);

  // === Sauvegarde ===
  const handleSave = async () => {
    if (!journal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries,
          observations,
          directorName,
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success("✅ Cahier journal enregistré");
      loadJournal();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Soumission au directeur ===
  const handleSubmit = async () => {
    if (!journal) return;
    if (!confirm("Soumettre ce cahier journal au directeur ? Cette action est irréversible.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Cahier journal soumis au directeur");
      loadJournal();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // === Navigation entre semaines ===
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const thisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  // === Mise à jour d'une case (day × subject) ===
  const updateEntry = (dayKey: string, subjectKey: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || {}),
        [subjectKey]: value,
      },
    }));
  };

  const getEntry = (dayKey: string, subjectKey: string): string => {
    return entries[dayKey]?.[subjectKey] || "";
  };

  const selectedClass = classes.find(c => c.classId === selectedClassId);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const isReadOnly = journal && (journal.status === "SUBMITTED" || journal.status === "VALIDATED");
  const statusConfig = journal ? STATUS_CONFIG[journal.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="space-y-4">
      {/* === En-tête : classe + semaine + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classe</label>
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

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Semaine</label>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[180px] text-center">
              du {formatDateFR(formatDate(weekStart))} au {formatDateFR(formatDate(weekEnd))}
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={thisWeek} className="ml-1 p-2 hover:bg-blue-100 text-blue-600 rounded-lg" title="Cette semaine">
              <Calendar className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {statusConfig && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide", statusConfig.color)}>
            <statusConfig.icon className="h-4 w-4" />
            {statusConfig.label}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading || !journal || isReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading || !journal || journal.status !== "DRAFT"}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Soumettre
          </button>
        </div>
      </div>

      {journal?.status === "REJECTED" && journal.rejectionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>Motif du rejet :</strong> {journal.rejectionReason}
        </div>
      )}

      {/* === En-tête du document === */}
      {!loading && journal && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 print:shadow-none">
          {dynamicSubjects.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <strong>Aucune matière configurée pour cette classe.</strong> L'administration de l'école
              doit d'abord configurer les matières dans le module Matières (table class_subjects).
            </div>
          )}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">CAHIER JOURNAL</h2>
              <div className="text-sm text-slate-600">
                Nom de la classe : <span className="font-semibold">{selectedClass?.className || "—"}</span>
              </div>
              <div className="text-sm text-slate-600">
                Effectif : {selectedClass?.totalStudents || 0} élèves
                ({selectedClass?.boys || 0} G, {selectedClass?.girls || 0} F)
              </div>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div>Semaine du <span className="font-semibold">{formatDateFR(formatDate(weekStart))}</span></div>
              <div>au <span className="font-semibold">{formatDateFR(formatDate(weekEnd))}</span></div>
              <div className="text-xs text-slate-400 mt-1">
                Année académique {academicYearId.slice(0, 8)}
              </div>
            </div>
          </div>

          {/* === PAGE 1 (RECTO) === JOURS | FRANÇAIS | ANGLAIS | MATH | OBSERVATIONS */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 1 — Recto</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {RECTO_SUBJECTS.map((s) => (
                    <th key={s.subjectName} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "180px" }}>
                      <div>{s.subjectName}</div>
                    </th>
                  ))}
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                    OBSERVATIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                      <div className="text-[10px] text-slate-400 mt-1 font-normal">
                        {formatDateFR(formatDate(new Date(weekStart.getTime() + (day.id - 1) * 86400000)))}
                      </div>
                    </td>
                    {RECTO_SUBJECTS.map((s) => (
                      <td key={s.subjectName} className="border border-slate-300 p-0">
                        <textarea
                          value={getEntry(day.key, s.subjectName)}
                          onChange={(e) => updateEntry(day.key, s.subjectName, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="—"
                          className="w-full h-24 px-2 py-1 text-xs text-slate-700 resize-none border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td className="border border-slate-300 p-0">
                      <textarea
                        value={getEntry(day.key, "observations")}
                        onChange={(e) => updateEntry(day.key, "observations", e.target.value)}
                        disabled={isReadOnly}
                        placeholder="—"
                        className="w-full h-24 px-2 py-1 text-xs text-slate-700 resize-none border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === PAGE 2 (VERSO) === EST | ES | EPS | EA | PETIT PROJET */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 2 — Verso</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {VERSO_SUBJECTS.map((s) => (
                    <th key={s.subjectName} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                      <div>{s.subjectName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                    </td>
                    {VERSO_SUBJECTS.map((s) => (
                      <td key={s.subjectName} className="border border-slate-300 p-0">
                        <textarea
                          value={getEntry(day.key, s.subjectName)}
                          onChange={(e) => updateEntry(day.key, s.subjectName, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="—"
                          className="w-full h-24 px-2 py-1 text-xs text-slate-700 resize-none border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-blue-50/30 disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === OBSERVATIONS GLOBALES (bas de page) === */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Observations générales de la semaine
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              disabled={isReadOnly}
              rows={3}
              placeholder="Observations générales sur la semaine..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50"
            />
          </div>

          {/* === PIED DE PAGE — Signature Directeur === */}
          <div className="border-t-2 border-slate-300 pt-4 mt-6 flex justify-between items-end gap-8">
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Directeur/Directrice</div>
              <input
                type="text"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                disabled={isReadOnly}
                placeholder="Nom et signature"
                className="w-full px-3 py-2 text-sm border-b-2 border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent"
              />
              <div className="text-[10px] text-slate-400 mt-1">D _______ DIRECT _______</div>
            </div>
            <div className="flex-1 text-right">
              {journal.directorValidatedAt && (
                <div className="text-xs text-emerald-600 font-semibold">
                  Validé le {formatDateFR(journal.directorValidatedAt)}
                </div>
              )}
              {journal.validatedBy && (
                <div className="text-[10px] text-slate-500 mt-1">Par: {journal.validatedBy}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === États de chargement === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement du cahier journal…
        </div>
      )}

      {!loading && !selectedClassId && classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <NotebookPen className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune classe assignée</p>
          <p className="text-sm text-slate-500 mt-1">Vous n'avez pas de classe assignée pour cette année.</p>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          Ce cahier journal est verrouillé (statut: {journal?.status}). Vous ne pouvez plus le modifier.
        </div>
      )}
    </div>
  );
}
