"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  History,
  LogIn,
  PencilLine,
  Download,
  Loader2,
  CalendarDays,
  Activity,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  getProfile,
  type ProspectProfile,
} from "@/lib/saisiemaster/api";

/**
 * Vue "Historique" :
 *  - Récupère le profil depuis le backend (loginCount, gradesEntered,
 *    exportsCount, lastLoginAt, signupDate).
 *  - Affiche un récap des statistiques d'activité + une timeline
 *    chronologique reconstituée à partir des dates connues.
 *  - Si le profil n'est pas accessible, affiche un message d'erreur clair.
 */
export function HistoryView() {
  const [profile, setProfile] = useState<ProspectProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getProfile();
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Impossible de charger l'historique.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-[#0D6EFD]" />
          Historique
        </h2>
        <Card className="p-8 flex flex-col items-center justify-center gap-3 border-dashed">
          <Loader2 className="h-6 w-6 animate-spin text-[#0D6EFD]" />
          <p className="text-sm text-muted-foreground">
            Chargement de votre activité…
          </p>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-[#0D6EFD]" />
          Historique
        </h2>
        <Card className="p-6 border-[#DC3545]/30 bg-[#DC3545]/5">
          <p className="text-sm text-[#DC3545] font-medium mb-1">
            Impossible de charger l&apos;historique
          </p>
          <p className="text-xs text-muted-foreground">
            {error ?? "Veuillez vous reconnecter puis réessayer."}
          </p>
        </Card>
      </div>
    );
  }

  // Construire une timeline synthétique à partir des compteurs.
  // Le backend ne stocke pas (encore) un journal détaillé, on reconstruit
  // donc une vue chronologique avec les jalons clés.
  const events = buildTimeline(profile);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-[#0D6EFD]" />
          Historique
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Votre activité sur SaisieMaster.
        </p>
      </div>

      {/* Stats summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={LogIn}
          label="Connexions"
          value={profile.loginCount}
          color="#0D6EFD"
        />
        <StatCard
          icon={PencilLine}
          label="Notes saisies"
          value={profile.gradesEntered}
          color="#008751"
        />
        <StatCard
          icon={Download}
          label="Exports Excel"
          value={profile.exportsCount}
          color="#FD7E14"
        />
        <StatCard
          icon={Activity}
          label="Classes créées"
          value={profile.classesCreated}
          color="#7C3AED"
        />
      </div>

      {/* Timeline */}
      <Card className="p-4 sm:p-6 border-border/60 shadow-sm bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[#0D6EFD]" />
          <h3 className="text-sm font-semibold text-foreground">
            Chronologie
          </h3>
        </div>

        {events.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Aucune activité enregistrée pour l&apos;instant.
          </div>
        ) : (
          <ol className="relative border-l-2 border-border/60 ml-3 space-y-5">
            {events.map((event, idx) => {
              const Icon = event.icon;
              return (
                <li key={idx} className="ml-6 sm:ml-8">
                  <span
                    className="absolute -left-[1.05rem] grid place-items-center h-7 w-7 rounded-full ring-4 ring-background"
                    style={{ background: `${event.color}15`, color: event.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {event.title}
                    </p>
                    <time className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {event.timestamp}
                    </time>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Stat card
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof LogIn;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="p-3 sm:p-4 border-border/60 shadow-sm bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="grid place-items-center h-7 w-7 rounded-md shrink-0"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
        {value}
      </p>
    </Card>
  );
}

// ============================================================================
// Timeline builder
// ============================================================================

interface TimelineEvent {
  title: string;
  description?: string;
  timestamp: string;
  icon: typeof LogIn;
  color: string;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function buildTimeline(p: ProspectProfile): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Signup
  events.push({
    title: "Création du compte",
    description: `Bienvenue ${p.firstName} ! Votre compte SaisieMaster a été créé.`,
    timestamp: fmt(p.signupDate),
    icon: CalendarDays,
    color: "#0D6EFD",
  });

  // Grades entered (regroupés comme un seul jalon récapitulatif)
  if (p.gradesEntered > 0) {
    events.push({
      title: `${p.gradesEntered} note(s) saisie(s)`,
      description:
        "Total cumulé des notes entrées dans toutes vos classes (compteur d'activité).",
      timestamp: p.lastLoginAt ? fmt(p.lastLoginAt) : "—",
      icon: PencilLine,
      color: "#008751",
    });
  }

  // Exports
  if (p.exportsCount > 0) {
    events.push({
      title: `${p.exportsCount} export(s) Excel`,
      description: "Fichiers EducMaster générés et téléchargés.",
      timestamp: p.lastLoginAt ? fmt(p.lastLoginAt) : "—",
      icon: Download,
      color: "#FD7E14",
    });
  }

  // Last login
  if (p.lastLoginAt) {
    events.push({
      title: "Dernière connexion",
      description: `Connexion #${p.loginCount} au total.`,
      timestamp: fmt(p.lastLoginAt),
      icon: LogIn,
      color: "#0D6EFD",
    });
  }

  // Tri du plus ancien au plus récent
  return events.sort((a, b) => {
    const da = a.timestamp === "—" ? 0 : Date.parse(a.timestamp);
    const db = b.timestamp === "—" ? 0 : Date.parse(b.timestamp);
    return da - db;
  });
}
