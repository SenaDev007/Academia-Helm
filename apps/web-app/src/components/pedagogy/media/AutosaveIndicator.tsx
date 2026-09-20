"use client";

/**
 * ============================================================================
 * AutosaveIndicator — Micro-indicateur de sauvegarde automatique
 * ============================================================================
 *
 * ⭐ Exigence utilisateur : « même s'il y a sauvegarde, l'utilisateur ne le
 *   remarque pas » → l'indicateur est VOLONTAIREMENT très discret :
 *   - petite pastille gris clair (text-[10px]) dans la barre d'actions
 *   - aucun toast, aucune animation intrusive, aucun blocage de l'UI
 *   - affiche « Enregistré à 10:42 » après une sauvegarde réussie
 *   - en cas d'échec (hors-ligne…) : point orange discret + « En attente »
 *     (la sauvegarde sera retentée automatiquement toutes les 10 s)
 *   - état « saving » : simple point pulsant (pas de spinner bloquant)
 * ============================================================================
 */

import type { AutoSaveStatus } from "@/hooks/useAutoSave";

export function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === "paused" || status === "idle") return null;

  const time = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-[10px] font-medium select-none"
        title="Sauvegarde automatique en attente (connexion) — nouvelle tentative dans quelques secondes"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Enregistrement en attente…
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-400 text-[10px] font-medium select-none"
        title="Sauvegarde automatique en cours"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
        Enregistrement…
      </span>
    );
  }

  // saved
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50/70 text-emerald-600/80 text-[10px] font-medium select-none"
      title="Sauvegarde automatique active — vos modifications sont enregistrées toutes les 10 secondes"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {time ? `Enregistré à ${time}` : "Enregistré"}
    </span>
  );
}
