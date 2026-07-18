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

export function StatsPanel() {
  const { classes, activeClassIndex } = useSaisieMasterStore();
  const classData = classes[activeClassIndex];

  const stats = useMemo(
    () => (classData ? computeSaisieStats(classData) : null),
    [classData],
  );

  if (!classData || !stats) return null;

  const completionColor =
    stats.completionRate === 100
      ? "#008751"
      : stats.completionRate >= 50
        ? "#fcd116"
        : "#e31b23";

  const cards = [
    {
      icon: Users,
      label: "Élèves",
      value: classData.students.length,
      sub: `${stats.etudiantsComplets} complet${
        stats.etudiantsComplets > 1 ? "s" : ""
      }`,
      color: "#0b3b6b",
      bg: "rgba(11, 59, 107, 0.08)",
    },
    {
      icon: BookOpen,
      label: "Matières",
      value: classData.subjects.length,
      sub: `${classData.subjects.filter((s) => s.hasPerfectionnement).length} avec perf.`,
      color: "#008751",
      bg: "rgba(0, 135, 81, 0.08)",
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
      color: "#fcd116",
      bg: "rgba(252, 209, 22, 0.18)",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.label}
            className="p-3 sm:p-4 border-border/60 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="grid place-items-center h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0"
                style={{ background: c.bg, color: c.color }}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground truncate">
                  {c.label}
                </p>
                <p className="text-lg sm:text-xl font-bold text-foreground leading-tight">
                  {c.value}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{c.sub}</p>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Barre de progression globale */}
      <Card className="col-span-2 sm:col-span-4 p-3 sm:p-4 border-border/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#008751]" />
            <span className="text-xs sm:text-sm font-medium text-foreground">
              Progression de la saisie
            </span>
          </div>
          <span
            className={cn(
              "text-xs sm:text-sm font-bold",
              stats.completionRate === 100
                ? "text-[#008751]"
                : stats.completionRate >= 50
                  ? "text-[#8a6d0b]"
                  : "text-[#e31b23]",
            )}
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
        <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
          {stats.completionRate === 100
            ? "✓ Toutes les notes sont saisies — vous pouvez exporter"
            : stats.completionRate >= 50
              ? "Plus de la moitié des notes saisies — continuez !"
              : "Commencez à saisir les notes dans le tableau ci-dessous"}
        </p>
      </Card>
    </div>
  );
}
