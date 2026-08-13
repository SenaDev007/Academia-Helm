"use client";

/**
 * ============================================================================
 * DESKTOP DOWNLOAD BADGE — Bouton de téléchargement desktop (promoteur uniquement)
 * ============================================================================
 *
 * Ce composant s'affiche dans le header de l'application web.
 * Il est visible UNIQUEMENT par le rôle PROMOTER (propriétaire de l'école).
 *
 * Fonctionnalités :
 *   1. Bouton "Télécharger l'app desktop" → redirige vers la page de download
 *   2. Badge "Mise à jour disponible" si une nouvelle version Tauri est sortie
 *   3. Info-bulle avec la version actuelle installée (si détectable)
 *
 * Détection de l'environnement :
 *   - Si l'utilisateur est dans Tauri (window.__TAURI__ existe) → on masque le bouton
 *   - Sinon (navigateur web) → on affiche le bouton
 *
 * Auto-update :
 *   - L'app desktop vérifie automatiquement les mises à jour au démarrage
 *   - Si une mise à jour est disponible, l'utilisateur voit une notification native
 *   - Le badge ici sert aussi à informer le promoteur qu'il peut installer la dernière version
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { Download, Monitor, Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Palette Academia Helm (identique web/desktop/mobile) ──
const NAVY = "#0b2f73";
const BLUE = "#1d4fa5";
const GOLD = "#f5b335";
const EMERALD = "#0d7c66";

interface DesktopUpdateBadgeProps {
  /** Rôle de l'utilisateur — seul 'PROMOTER' voit ce bouton */
  userRole?: string;
  /** Version actuelle de l'app desktop (si détectée via Tauri API) */
  currentDesktopVersion?: string;
  /** Dernière version disponible (depuis l'API) */
  latestVersion?: string;
  /** URL de téléchargement */
  downloadUrl?: string;
}

export function DesktopUpdateBadge({
  userRole,
  currentDesktopVersion,
  latestVersion,
  downloadUrl,
}: DesktopUpdateBadgeProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [isInTauri, setIsInTauri] = useState(false);

  // ── Détection : est-on dans l'app desktop Tauri ? ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      // @ts-ignore — __TAURI__ est injecté par Tauri
      setIsInTauri(!!window.__TAURI__);
    }
  }, []);

  // ── Masquer si pas promoteur OU si déjà dans Tauri ──
  if (userRole !== "PROMOTER" || isInTauri) {
    return null;
  }

  // ── Vérifier si une mise à jour est disponible ──
  const hasUpdate =
    latestVersion &&
    currentDesktopVersion &&
    latestVersion !== currentDesktopVersion;

  const handleDownload = () => {
    // ⭐ Rediriger directement vers /downloads (pas de modal, pas de nouvel onglet)
    window.location.href = '/downloads';
  };

  return (
    <>
      {/* ── Bouton dans le header — redirige directement vers /downloads ── */}
      <div className="relative">
        <button
          onClick={handleDownload}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            hasUpdate
              ? "bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
              : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          )}
          title={
            hasUpdate
              ? `Mise à jour desktop disponible (${latestVersion})`
              : "Télécharger l'application desktop"
          }
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Desktop</span>
          {hasUpdate && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
              !
            </span>
          )}
        </button>
      </div>
    </>
  );
}
