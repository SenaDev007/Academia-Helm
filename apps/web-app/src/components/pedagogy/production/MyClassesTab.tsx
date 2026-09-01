"use client";

/**
 * Mes Classes — Vue d'ensemble des classes assignées à l'enseignant.
 * Affiche : nom, niveau, effectifs (G/F/total), matières enseignées.
 * Clic sur une classe → vue détaillée (liste élèves).
 *
 * ⭐ Offline-aware : si la connexion est indisponible, on retombe sur
 *    IndexedDB (store `teacherclassassignment`) qui est peuplé par le sync
 *    engine PULL. Avant ce fix, on utilisait raw fetch() → si offline,
 *    on catchait l'erreur et on affichait "Aucune classe" — alors que
 *    l'enseignant en avait bien.
 */

import { useState, useEffect, useCallback } from "react";
import { Users, BookOpen, ChevronRight, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { offlineFetch } from "@/lib/offline/offline-fetch";
import { formatWeeklyDuration } from "@/lib/utils/duration";

interface MyClassesTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function MyClassesTab({ tenantId, academicYearId, teacherId }: MyClassesTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      // ⭐ offlineFetch — essaie le réseau, et si ça échoue, lit IndexedDB
      //    (store "teacherclassassignment"). Si le cache est aussi vide,
      //    lance une erreur réelle pour que l'UI puisse la distinguer
      //    d'un "légitimement pas de données".
      // ⭐ Filtre language=FR : l'Espace Pédagogique FR ne doit afficher QUE
      //    les matières francophones. Les matières anglophones (language=EN)
      //    sont exclues. Les matières sans langue (NULL ou '') sont conservées
      //    car elles sont communes aux deux pistes (par compatibilité avec
      //    les données antérieures à l'introduction de la piste EN).
      const data = await offlineFetch<any>(
        `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}&language=FR`,
        "teacherclassassignment",
        { tenantId }
      );
      let classList = Array.isArray(data) ? data : (data?.data ?? []);

      // ⭐ Filtrer côté client les matières par langue : on ne garde QUE
      //    les matières FR (et les matières sans langue, communes aux deux pistes).
      //    Le paramètre `language=FR` envoyé au backend est un hint — le filtre
      //    côté client est la source de vérité (le backend peut ne pas supporter
      //    le filtre selon la version).
      classList = classList.map((cls: any) => {
        if (!cls.subjects || cls.subjects.length === 0) return cls;
        const frSubjects = cls.subjects.filter((s: any) => {
          const lang = (s.subjectLanguage || s.language || '').toUpperCase();
          // ⭐ On garde : FR (piste francophone) + '' (commun) + NULL (legacy)
          //    On exclut : EN (piste anglophone — gérée par l'Espace Pédagogique EN)
          return lang === 'FR' || lang === '';
        });
        return { ...cls, subjects: frSubjects };
      });

      setClasses(classList);
    } catch (e: any) {
      // Si on est offline ET le cache est vide, on affiche un message clair
      // plutôt que de simuler "pas de classes".
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        toast.warning("Hors ligne", {
          description: "Vous êtes hors ligne et les données de classes n'ont pas encore été mises en cache. Reconnectez-vous pour charger vos classes.",
        });
      } else {
        toast.error("Erreur", { description: e?.message || "Erreur de chargement" });
      }
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, tenantId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Vue détaillée d'une classe (liste élèves)
  if (selectedClass) {
    return (
      <div className="space-y-4">
        {/* Header avec retour */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedClass(null)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{selectedClass.className}</h3>
            <p className="text-sm text-slate-500">{selectedClass.schoolLevelName}</p>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{selectedClass.totalStudents}</div>
            <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Total</div>
          </div>
          <div className="bg-cyan-50 rounded-xl p-4 text-center border border-cyan-100">
            <div className="text-2xl font-bold text-cyan-600">{selectedClass.boys}</div>
            <div className="text-xs text-cyan-600 font-medium uppercase tracking-wider">Garçons</div>
          </div>
          <div className="bg-pink-50 rounded-xl p-4 text-center border border-pink-100">
            <div className="text-2xl font-bold text-pink-600">{selectedClass.girls}</div>
            <div className="text-xs text-pink-600 font-medium uppercase tracking-wider">Filles</div>
          </div>
        </div>

        {/* Matières enseignées */}
        {selectedClass.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedClass.subjects.map((s: any) => (
              <span key={s.subjectId} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                <BookOpen className="h-3 w-3" />
                {s.subjectName}
                {s.weeklyHours ? ` (${formatWeeklyDuration(s.weeklyHours)})` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Liste des élèves */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">N°</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Matricule</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Sexe</th>
              </tr>
            </thead>
            <tbody>
              {selectedClass.students?.slice().sort((a: any, b: any) => {
                const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                return aName.localeCompare(bName, 'fr');
              }).map((s: any, idx: number) => (
                <tr key={s.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {s.lastName} {s.firstName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{s.matricule || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                      s.gender === "M" ? "bg-cyan-100 text-cyan-700" : "bg-pink-100 text-pink-700"
                    )}>
                      {s.gender === "M" ? "M" : "F"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Vue liste des classes
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Mes Classes</h3>
          <p className="text-sm text-slate-500">
            {loading ? "Chargement…" : `${classes.length} classe(s) assignée(s)`}
          </p>
        </div>
        <button
          onClick={loadClasses}
          disabled={loading}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">Aucune classe assignée</p>
          <p className="text-sm text-slate-400 mt-1">
            Contactez l'administration pour recevoir des affectations de classe.
          </p>
        </div>
      ) : (
        /* Grille de cartes classes */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <button
              key={cls.classId}
              onClick={() => setSelectedClass(cls)}
              className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* Header carte */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{cls.className}</h4>
                  <p className="text-xs text-slate-500">{cls.schoolLevelName}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">{cls.totalStudents}</span>
                  <span className="text-xs text-slate-400">élèves</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-cyan-600">{cls.boys}G</span>
                  <span className="text-slate-200">·</span>
                  <span className="text-xs font-medium text-pink-600">{cls.girls}F</span>
                </div>
              </div>

              {/* Matières */}
              {cls.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cls.subjects.slice(0, 3).map((s: any) => (
                    <span key={s.subjectId} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
                      {s.subjectName}
                    </span>
                  ))}
                  {cls.subjects.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      +{cls.subjects.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper (avoid importing cn from different path)
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
