"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Cahier Journal [/app/parent/cahier-journal]
 * ============================================================================
 *
 * Consultation du cahier journal hebdomadaire de la classe de l'enfant.
 *
 * Le parent sélectionne un enfant → on récupère son classId →
 * on fetch /api/parent/cahier-journal/:classId?weekStart=YYYY-MM-DD
 *
 * Affichage : 5 jours (lundi→vendredi), avec pour chaque jour la liste
 * des matières programmées + thème + contenu + devoirs.
 *
 * Navigation entre semaines via le sélecteur.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  BookOpen, Loader2, ChevronLeft, ChevronRight, Calendar,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
const DAY_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
};

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
  }, [classId, weekStart, academicYear?.id]);

  useEffect(() => {
    loadCahier();
  }, [loadCahier]);

  // Navigation entre semaines
  const goToPreviousWeek = () => {
    const d = parseISO(weekStart);
    setWeekStart(format(addDays(d, -7), "yyyy-MM-dd"));
  };
  const goToNextWeek = () => {
    const d = parseISO(weekStart);
    setWeekStart(format(addDays(d, 7), "yyyy-MM-dd"));
  };
  const goToCurrentWeek = () => {
    setWeekStart(format(getMonday(new Date()), "yyyy-MM-dd"));
  };

  const weekStartDate = parseISO(weekStart);
  const weekEndDate = addDays(weekStartDate, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Cahier journal de la classe</h2>
      </div>

      {/* Sélecteur enfant */}
      {children.length > 1 && (
        <select
          value={selectedChild}
          onChange={(e) => setSelectedChild(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} — {c.className || "Classe"}
            </option>
          ))}
        </select>
      )}

      {/* Navigation semaine */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-slate-100 rounded-lg"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-slate-900 text-sm">
              Semaine du {format(weekStartDate, "d MMM", { locale: fr })} au {format(weekEndDate, "d MMM yyyy", { locale: fr })}
            </span>
          </div>
          <button
            onClick={goToCurrentWeek}
            className="text-xs text-blue-600 hover:underline mt-0.5"
          >
            Semaine courante
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-slate-100 rounded-lg"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Semaines disponibles (navigation rapide) */}
      {availableWeeks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableWeeks.slice(0, 8).map((w) => (
            <button
              key={w.weekStart}
              onClick={() => setWeekStart(w.weekStart)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                w.weekStart === weekStart
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {format(parseISO(w.weekStart), "d MMM", { locale: fr })}
            </button>
          ))}
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !data || !data.available ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{data?.message || "Cahier journal non disponible pour cette semaine."}</p>
          <p className="text-xs text-slate-400 mt-1">
            Le cahier journal est rempli chaque semaine par l'enseignant titulaire.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Statut cahier */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
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
                  <Clock className="h-3 w-3" /> Soumis au directeur
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

          {/* Grille des jours */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {DAY_KEYS.map((dayKey) => {
              const dayDate = addDays(weekStartDate, DAY_KEYS.indexOf(dayKey));
              const dayEntries = data.entries?.[dayKey] || null;

              return (
                <div
                  key={dayKey}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col"
                >
                  {/* En-tête jour */}
                  <div className="bg-blue-50 border-b border-blue-100 px-3 py-2">
                    <div className="font-bold text-blue-900 text-sm">{DAY_LABELS[dayKey]}</div>
                    <div className="text-xs text-blue-600">
                      {format(dayDate, "d MMM", { locale: fr })}
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="p-3 flex-1">
                    {renderDayEntries(dayEntries)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observations générales */}
          {data.observations && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-amber-900 mb-2">Observations de la semaine</h3>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{data.observations}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper : rendu des entrées d'un jour ──
function renderDayEntries(dayEntries: any) {
  if (!dayEntries) {
    return <p className="text-xs text-slate-400">Aucune séance</p>;
  }

  // dayEntries peut être :
  // - un array de séances [{ subjectName, topic, content, homework, durationHours }]
  // - un objet { subjectId: { ...séance } }
  let subjects: any[] = [];
  if (Array.isArray(dayEntries)) {
    subjects = dayEntries;
  } else if (typeof dayEntries === "object") {
    for (const [k, v] of Object.entries(dayEntries)) {
      if (v && typeof v === "object") {
        subjects.push({ ...(v as object), _key: k });
      }
    }
  }

  if (subjects.length === 0) {
    return <p className="text-xs text-slate-400">Aucune séance programmée</p>;
  }

  return (
    <div className="space-y-2">
      {subjects.map((s, i) => (
        <div key={s._key || i} className="text-xs">
          <div className="font-semibold text-slate-900">
            {s.subjectName || s.label || s.matiere || "Matière"}
          </div>
          {s.durationHours && (
            <div className="text-slate-400 text-[10px]">Durée : {s.durationHours}h</div>
          )}
          {s.topic && (
            <div className="text-slate-700 mt-0.5">
              <span className="font-medium">Thème :</span> {s.topic}
            </div>
          )}
          {s.content && (
            <div className="text-slate-600 mt-0.5">
              <span className="font-medium">Contenu :</span> {s.content}
            </div>
          )}
          {s.homework && (
            <div className="text-amber-700 mt-0.5 bg-amber-50 p-1 rounded">
              <span className="font-medium">Devoir :</span> {s.homework}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Helper : calculer le lundi d'une date ──
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
