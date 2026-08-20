"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Cahier Journal [/app/parent/cahier-journal]
 * ============================================================================
 *
 * Affichage IDENTIQUE au cahier journal de l'enseignant :
 *   - Grille 5 jours (Lun→Ven) × matières groupées
 *   - Format recto/verso (2 pages)
 *   - Contenu en HTML riche (read-only, PAS d'éditeur)
 *   - PAS d'observations du directeur (retirées pour le parent)
 *   - Sélection enfant + navigation entre semaines
 *
 * Endpoint : GET /api/parent/cahier-journal/:classId?weekStart=YYYY-MM-DD
 * Retourne : { entries: { lundi: { "Français": "<HTML>", ... }, ... } }
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  BookOpen, Loader2, ChevronLeft, ChevronRight, Calendar,
  CheckCircle2, Clock, AlertCircle, Users,
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// === CONSTANTES — IDENTIQUES AU CAHIER JOURNAL ENSEIGNANT ===

const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

// ⭐ Groupes de matières — identiques au CahierJournalTab enseignant
const SUBJECT_GROUPS = [
  {
    groupName: "Français",
    subjects: [
      "Dictée", "Grammaire", "Conjugaison", "Lecture", "Vocabulaire",
      "Orthographe", "Expression écrite", "Graphisme", "Écriture",
      "Combinatoire", "Communication orale", "Exercices structuraux",
      "Dictee", "Exercices Structuraux", "Communication Orale",
      "Expression Ecrite",
    ],
  },
  {
    groupName: "Mathématiques",
    subjects: [
      "Numération", "Calcul", "Géométrie", "Mesure", "Problèmes",
      "Calcul mental", "Mathématiques", "Maths",
    ],
  },
  {
    groupName: "Éducation scientifique et technologique",
    subjects: [
      "Sciences", "Histoire", "Géographie", "EPS", "Éducation physique",
      "Éducation scientifique et technologique", "Leçon de choses",
      "Sciences et technologie", "EST", "Sciences d'éveil",
    ],
  },
  {
    groupName: "Éducation sociale",
    subjects: [
      "Morale", "Civisme", "Histoire", "Géographie", "Geographie",
      "Education sociale", "Éducation sociale",
    ],
  },
  {
    groupName: "Éducation artistique",
    subjects: [
      "Chant", "Poésie", "Dessin", "Compte", "Couture", "Atelier",
      "Art dramatique", "Éducation artistique plastique",
      "Éducation artistique vivante", "Education artistique plastique",
      "Education artistique vivante", "Poesie",
    ],
  },
];

// Type pour une colonne du tableau (groupée ou individuelle)
type TableColumn =
  | { type: "group"; groupName: string; subjects: string[] }
  | { type: "single"; subject: string };

// ⭐ Helper : parser les entries JSON (string ou objet)
function parseEntries(entries: any): Record<string, Record<string, string>> {
  if (!entries) return {};
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return {}; }
  }
  return entries as Record<string, Record<string, string>>;
}

// ⭐ Helper : extraire la liste des matières depuis les entries
//    (clés des objets jour, en excluant "observations" et "directorObservation")
function extractSubjects(entries: Record<string, Record<string, string>>): string[] {
  const subjects = new Set<string>();
  for (const dayKey of Object.keys(entries)) {
    const dayData = entries[dayKey];
    if (dayData && typeof dayData === "object") {
      for (const key of Object.keys(dayData)) {
        if (key !== "observations" && key !== "directorObservation" && key !== "_key") {
          subjects.add(key);
        }
      }
    }
  }
  return Array.from(subjects);
}

// ⭐ Helper : transformer la liste plate de matières en colonnes groupées
function buildGroupedColumns(subjectNames: string[]): TableColumn[] {
  const used = new Set<string>();
  const result: TableColumn[] = [];

  for (const group of SUBJECT_GROUPS) {
    const matching = subjectNames.filter((name) => {
      const lower = name.trim().toLowerCase();
      return group.subjects.some(g => g.trim().toLowerCase() === lower);
    });
    if (matching.length > 0) {
      result.push({ type: "group", groupName: group.groupName, subjects: matching });
      matching.forEach(s => used.add(s));
    }
  }

  for (const s of subjectNames) {
    if (!used.has(s)) {
      result.push({ type: "single", subject: s });
    }
  }

  return result;
}

// ⭐ Helper : obtenir la clé d'entrée pour une colonne
function getColumnKey(col: TableColumn): string {
  if (col.type === "group") return col.groupName;
  return col.subject;
}

// ⭐ Helper : sous-étiquettes d'une colonne groupée
function getColumnSubLabels(col: TableColumn): string[] {
  if (col.type === "group") return col.subjects;
  return [];
}

// ⭐ Helper : obtenir le contenu d'une cellule
function getEntry(
  entries: Record<string, Record<string, string>>,
  dayKey: string,
  subjectKey: string,
): string {
  return entries[dayKey]?.[subjectKey] || "";
}

// ⭐ Helper : détecter si un string est du HTML
function isHTML(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

// ⭐ Helper : formater une date "dd/MM/yyyy"
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ⭐ Helper : calculer le lundi d'une date
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ParentCahierJournalPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>(
    format(getMonday(new Date()), "yyyy-MM-dd")
  );
  const [data, setData] = useState<any>(null);
  const [availableWeeks, setAvailableWeeks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Charger les enfants ──
  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`,
          { credentials: "include" }
        );
        const list = await res.json();
        const arr = Array.isArray(list) ? list : [];
        setChildren(arr);
        if (arr.length > 0) {
          setSelectedChild(arr[0].id);
          setClassId(arr[0].classId || "");
        }
      } catch {
        setChildren([]);
      }
    })();
  }, [user?.id, academicYear?.id]);

  // ── Mettre à jour le classId quand on change d'enfant ──
  useEffect(() => {
    const c = children.find((x) => x.id === selectedChild);
    setClassId(c?.classId || "");
  }, [selectedChild, children]);

  // ── Charger le cahier journal + semaines disponibles ──
  const loadCahier = useCallback(async () => {
    if (!classId || !academicYear?.id) return;
    setLoading(true);
    try {
      const [cjRes, weeksRes] = await Promise.all([
        fetch(
          `/api/parent/cahier-journal/${classId}?academicYearId=${academicYear.id}&weekStart=${weekStart}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/parent/weeks/${classId}?academicYearId=${academicYear.id}`,
          { credentials: "include" }
        ),
      ]);
      const cjData = await cjRes.json();
      const weeksData = await weeksRes.json();
      setData(cjData);
      setAvailableWeeks(Array.isArray(weeksData) ? weeksData : []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classId, academicYear?.id, weekStart]);

  useEffect(() => {
    loadCahier();
  }, [loadCahier]);

  // ── Navigation entre semaines ──
  const weekStartDate = parseISO(weekStart);
  const weekEndDate = addDays(weekStartDate, 4);
  const prevWeek = format(addDays(weekStartDate, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStartDate, 7), "yyyy-MM-dd");

  // ── Parser les entries et construire les colonnes ──
  const entries = parseEntries(data?.entries);
  const subjectNames = extractSubjects(entries);
  const groupedColumns = buildGroupedColumns(subjectNames);
  const RECTO_COLUMNS = groupedColumns.slice(0, Math.ceil(groupedColumns.length / 2));
  const VERSO_COLUMNS = groupedColumns.slice(Math.ceil(groupedColumns.length / 2));

  return (
    <div className="space-y-4">
      {/* === En-tête : sélection enfant + navigation semaines === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
        {/* Sélection enfant */}
        {children.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Enfant</label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} — {c.className || c.classId}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation semaines */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(prevWeek)}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Semaine précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center px-3">
            <div className="text-sm font-bold text-slate-900">
              Semaine du {formatDateFR(weekStart)}
            </div>
            <div className="text-xs text-slate-500">
              au {formatDateFR(format(weekEndDate, "yyyy-MM-dd"))}
            </div>
          </div>
          <button
            onClick={() => setWeekStart(nextWeek)}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Semaine suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Semaines disponibles */}
        {availableWeeks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableWeeks.slice(0, 8).map((w) => (
              <button
                key={w.weekStart}
                onClick={() => setWeekStart(w.weekStart)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  w.weekStart === weekStart
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {format(parseISO(w.weekStart), "d MMM", { locale: fr })}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* === Contenu === */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : !data || !data.available ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {data?.message || "Cahier journal non disponible pour cette semaine."}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Le cahier journal est rempli chaque semaine par l'enseignant titulaire.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* En-tête cahier */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Classe :</span>
              <span className="font-semibold text-slate-900">{data.className}</span>
              {data.levelName && (
                <span className="text-slate-400 text-xs">· {data.levelName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {data.status === "VALIDATED" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Validé
                </span>
              ) : data.status === "SUBMITTED" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  <Clock className="h-3 w-3" /> En attente de validation
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  <Clock className="h-3 w-3" /> {data.status || "Brouillon"}
                </span>
              )}
              {data.teacherName && (
                <span className="text-xs text-slate-500">
                  · Titulaire : {data.teacherName}
                </span>
              )}
            </div>
          </div>

          {/* === TITRE + INFOS CLASSE (identique à l'enseignant) === */}
          <div className="flex items-start justify-between mb-4 px-2">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">CAHIER JOURNAL</h2>
              <div className="text-sm text-slate-600">
                Nom de la classe : <span className="font-semibold">{data.className || "—"}</span>
              </div>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div>Semaine du <span className="font-semibold">{formatDateFR(weekStart)}</span></div>
              <div>au <span className="font-semibold">{formatDateFR(format(weekEndDate, "yyyy-MM-dd"))}</span></div>
            </div>
          </div>

          {/* === PAGE 1 (RECTO) — IDENTIQUE À L'ENSEIGNANT === */}
          {RECTO_COLUMNS.length > 0 && (
            <>
              <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 1 — Recto</div>
              <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                        JOURS
                      </th>
                      {RECTO_COLUMNS.map((col) => {
                        const key = getColumnKey(col);
                        const subLabels = getColumnSubLabels(col);
                        return (
                          <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "180px" }}>
                            <div className="font-bold">{key}</div>
                            {subLabels.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                                {subLabels.map((label, i) => (
                                  <span key={i}>
                                    {i > 0 && <span className="text-slate-300"> · </span>}
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const dayDate = addDays(weekStartDate, day.id - 1);
                      return (
                        <tr key={day.key} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                            {day.label}
                            <div className="text-[10px] text-slate-400 mt-1 font-normal">
                              {format(dayDate, "dd/MM", { locale: fr })}
                            </div>
                          </td>
                          {RECTO_COLUMNS.map((col) => {
                            const key = getColumnKey(col);
                            const content = getEntry(entries, day.key, key);
                            return (
                              <td key={key} className="border border-slate-300 p-2 align-top" style={{ minHeight: "96px" }}>
                                {content ? (
                                  isHTML(content) ? (
                                    <div
                                      className="text-xs text-slate-700 prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                  ) : (
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{content}</p>
                                  )
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* === PAGE 2 (VERSO) — IDENTIQUE À L'ENSEIGNANT === */}
          {VERSO_COLUMNS.length > 0 && (
            <>
              <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 2 — Verso</div>
              <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                        JOURS
                      </th>
                      {VERSO_COLUMNS.map((col) => {
                        const key = getColumnKey(col);
                        const subLabels = getColumnSubLabels(col);
                        return (
                          <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                            <div className="font-bold">{key}</div>
                            {subLabels.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                                {subLabels.map((label, i) => (
                                  <span key={i}>
                                    {i > 0 && <span className="text-slate-300"> · </span>}
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const dayDate = addDays(weekStartDate, day.id - 1);
                      return (
                        <tr key={day.key} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                            {day.label}
                            <div className="text-[10px] text-slate-400 mt-1 font-normal">
                              {format(dayDate, "dd/MM", { locale: fr })}
                            </div>
                          </td>
                          {VERSO_COLUMNS.map((col) => {
                            const key = getColumnKey(col);
                            const content = getEntry(entries, day.key, key);
                            return (
                              <td key={key} className="border border-slate-300 p-2 align-top" style={{ minHeight: "96px" }}>
                                {content ? (
                                  isHTML(content) ? (
                                    <div
                                      className="text-xs text-slate-700 prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                  ) : (
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{content}</p>
                                  )
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ⭐ PAS de section signatures dans l'UI parent — retirée */}
          {/* ⭐ PAS d'observations du directeur — retirées pour le parent */}
        </div>
      )}
    </div>
  );
}
