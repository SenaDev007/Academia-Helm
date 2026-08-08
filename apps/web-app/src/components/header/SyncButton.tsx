"use client";

/**
 * ============================================================================
 * SYNC BUTTON — Bouton "Synchroniser" dans le header
 * ============================================================================
 *
 * Affiche l'état de synchronisation et permet de déclencher une sync manuelle.
 *
 * États :
 *   - Idle : icône cloud + "Synchronisé" (gris)
 *   - Syncing : spinner + "Sync en cours..." (bleu)
 *   - Offline : icône cloud-off + "Hors ligne" (orange)
 *   - Error : icône erreur + "Échec sync" (rouge)
 *
 * Visible uniquement dans l'app desktop (Tauri) — masqué sur le web.
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { RefreshCw, Cloud, CloudOff, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  isDesktopApp,
  onConnectionChange,
  isOnlineNow,
} from "@/lib/offline/offline-sync";
import {
  onSyncStatusChange,
  manualSync,
  type SyncStatus,
} from "@/lib/offline/sync-worker";

export function SyncButton() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // ── Détection environnement + état initial ──
  useEffect(() => {
    setIsDesktop(isDesktopApp());
    setIsOnline(isOnlineNow());

    const unsubscribeConn = onConnectionChange((online) => {
      setIsOnline(online);
    });

    const unsubscribeSync = onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribeConn();
      unsubscribeSync();
    };
  }, []);

  // ── Masqué sur le web (uniquement desktop) ──
  if (!isDesktop) return null;

  // ── Gérer le clic sur le bouton ──
  const handleSync = async () => {
    if (!isOnline) {
      toast.info("Hors ligne", {
        description: "La synchronisation reprendra automatiquement au retour de la connexion.",
      });
      return;
    }

    setIsManualSyncing(true);
    toast.info("Synchronisation en cours...");

    const result = await manualSync();

    setIsManualSyncing(false);

    if (result.success) {
      toast.success("Synchronisation réussie", {
        description: `${result.entitiesSynced} entité(s) mise(s) à jour.`,
      });
    } else {
      toast.error("Échec de synchronisation", {
        description: result.error || "Une erreur est survenue.",
      });
    }
  };

  // ── Déterminer l'état affiché ──
  const isSyncing = syncStatus?.isSyncing || isManualSyncing;
  const hasError = !!syncStatus?.error;
  const lastSync = syncStatus?.lastSyncAt;

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Jamais";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    return `Il y a ${diffH}h`;
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border",
        !isOnline
          ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
          : isSyncing
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : hasError
              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      )}
      title={
        !isOnline
          ? "Hors ligne — la sync reprendra à la reconnexion"
          : isSyncing
            ? "Synchronisation en cours..."
            : hasError
              ? `Erreur: ${syncStatus?.error}`
              : `Dernière sync: ${formatLastSync(lastSync)} — cliquez pour synchroniser maintenant`
      }
    >
      <AnimatePresence mode="wait">
        {isSyncing ? (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          </motion.div>
        ) : !isOnline ? (
          <motion.div
            key="offline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CloudOff className="w-3.5 h-3.5" />
          </motion.div>
        ) : hasError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle className="w-3.5 h-3.5" />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Check className="w-3.5 h-3.5" />
          </motion.div>
        )}
      </AnimatePresence>

      <span className="hidden sm:inline">
        {isSyncing
          ? "Sync..."
          : !isOnline
            ? "Hors ligne"
            : hasError
              ? "Erreur"
              : "Synchronisé"}
      </span>

      {/* Badge avec le temps écoulé */}
      {!isSyncing && !hasError && isOnline && lastSync && (
        <span className="hidden md:inline text-[10px] opacity-60">
          {formatLastSync(lastSync)}
        </span>
      )}
    </button>
  );
}
