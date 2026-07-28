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
    // Rediriger vers la page de téléchargement publique
    const url = downloadUrl || "/downloads";
    window.open(url, "_blank");
    toast.success("Téléchargement", {
      description: "Redirection vers la page de téléchargement...",
    });
  };

  return (
    <>
      {/* ── Bouton dans le header ── */}
      <div className="relative">
        <button
          onClick={() => setShowBanner(true)}
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

      {/* ── Modal/banner de téléchargement ── */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowBanner(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête gradient */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
                <button
                  onClick={() => setShowBanner(false)}
                  className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <Monitor className="w-8 h-8" />
                  <h3 className="text-xl font-bold">Application Desktop</h3>
                </div>
                <p className="text-sm text-blue-100">
                  Academia Helm pour Windows — accès plus rapide, hors connexion
                </p>
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-4">
                {hasUpdate && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                    <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">
                        Mise à jour disponible
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Version {latestVersion} disponible
                        {currentDesktopVersion && ` (actuel: ${currentDesktopVersion})`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900 text-sm">
                    Avantages de l'app desktop :
                  </h4>
                  <ul className="space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Accès direct sans navigateur</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Mode hors connexion (base de données locale SQLite)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Synchronisation automatique avec Neon</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Mises à jour automatiques</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Mêmes données que la version web</span>
                    </li>
                  </ul>
                </div>

                {/* Bouton de téléchargement */}
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                  {hasUpdate
                    ? `Télécharger la version ${latestVersion}`
                    : "Télécharger pour Windows"}
                </button>

                <p className="text-xs text-slate-400 text-center">
                  L'installateur fait environ 10MB.
                  Windows 10/11 requis.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
