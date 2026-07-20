"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Users,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Award,
} from "lucide-react";
import { useSaisieMasterStore, computeSaisieStats } from "@/lib/saisiemaster/store";
import { cn } from "@/lib/saisiemaster/utils";

/**
 * Panneau de statistiques — version "clean summary panel".
 *
 * Affiche 4 cartes métriques (élèves, matières, saisie, moyenne classe) +
 * une barre de progression globale. Style minimaliste :
 *  - Fond blanc, bordures légères
 *  - Pas d'icônes criardes, palette cohérente avec le redesign
 *  - Couleurs d'accent : vert #198754 (ok), orange #FD7E14 (moyen), rouge #DC3545 (faible)
 */
export function StatsPanel() {
  const { classes, activeClassIndex, activeEvalType } = useSaisieMasterStore();
  const classData = classes[activeClassIndex];

  const stats = useMemo(
    () => (classData ? computeSaisieStats(classData, activeEvalType) : null),
    [classData, activeEvalType],
  );

  if (!classData || !stats) return null;

  const completionColor =
    stats.completionRate === 100
      ? "#198754"
      : stats.completionRate >= 50
        ? "#FD7E14"
        : "#DC3545";

  const cards = [
    {
      icon: Users,
      label: "Élèves",
      value: classData.students.length,
      sub: `${stats.etudiantsComplets} complet${
        stats.etudiantsComplets > 1 ? "s" : ""
      }`,
      color: "#0D6EFD",
      bg: "rgba(13, 110, 253, 0.08)",
    },
    {
      icon: BookOpen,
      label: "Matières",
      value: classData.subjects.length,
      sub: `${classData.subjects.filter((s) => s.hasPerfectionnement).length} avec perf.`,
      color: "#0D6EFD",
      bg: "rgba(13, 110, 253, 0.08)",
    },
    {
      icon: CheckCircle2,
      label: "Saisie",
      value: `${stats.completionRate}%`,
      sub: `${stats.filledCells} / ${stats.totalCells} cellules`,
      color: completionColor,
      bg: `${completionColor}15`,
    },
    {
      icon: Award,
      label: "Moyenne classe",
      value:
        stats.moyenneClasse !== null
          ? stats.moyenneClasse.toFixed(2)
          : "—",
      sub: stats.moyenneClasse !== null ? "sur 20" : "à calculer",
      color:
        stats.moyenneClasse === null
          ? "#6c757d"
          : stats.moyenneClasse >= 10
            ? "#198754"
            : "#DC3545",
      bg:
        stats.moyenneClasse === null
          ? "rgba(108, 117, 125, 0.10)"
          : stats.moyenneClasse >= 10
            ? "rgba(25, 135, 84, 0.10)"
            : "rgba(220, 53, 69, 0.10)",
    },
  ];

  return (
    <Card className="p-4 sm:p-5 border-border/60 shadow-sm bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#0D6EFD]" />
          <h3 className="text-sm font-semibold text-foreground">
            Résumé de la saisie
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Classe {classData.className}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-lg border border-border/40 bg-[#F8F9FA] dark:bg-zinc-900/40 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="grid place-items-center h-7 w-7 rounded-md shrink-0"
                  style={{ background: c.bg, color: c.color }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {c.label}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground leading-tight">
                {c.value}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {c.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Barre de progression globale */}
      <div className="mt-4 pt-4 border-t border-border/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-medium text-foreground">
            Progression de la saisie
          </span>
          <span
            className="text-xs sm:text-sm font-bold"
            style={{ color: completionColor }}
          >
            {stats.completionRate}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={stats.completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stats.completionRate}%`,
              backgroundColor: completionColor,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {stats.completionRate === 100
            ? "✓ Toutes les notes sont saisies — vous pouvez exporter."
            : stats.completionRate >= 50
              ? "Plus de la moitié des notes saisies — continuez !"
              : "Commencez à saisir les notes dans le tableau ci-dessous."}
        </p>
      </div>
    </Card>
  );
}
