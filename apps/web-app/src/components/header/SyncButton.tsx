"use client";

/**
 * ============================================================================
 * SYNC BUTTON — Bouton "Synchroniser" dans le header (UNIVERSEL)
 * ============================================================================
 *
 * Affiche l'état de synchronisation et permet de déclencher une sync manuelle.
 * Fonctionne sur TOUS les environnements : web (navigateur), desktop (Tauri), mobile.
 *
 * États :
 *   - Idle : icône check + "Synchronisé" (vert)
 *   - Syncing : spinner + "Sync..." (bleu)
 *   - Offline : icône cloud-off + "Hors ligne" (orange)
 *   - Error : icône erreur + "Erreur" (rouge)
 *   - Pending : badge avec le nombre d'écritures en attente
 *
 * Pattern Git :
 *   - Cliquer = "git pull" + "git push" (récupère les changements distants
 *     + pousse les changements locaux)
 *   - Auto-sync toutes les 30s si online
 *   - Sync immédiate au retour de connexion
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CloudOff, Check, AlertCircle, Cloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { networkDetectionService } from "@/lib/offline/network-detection.service";

export function SyncButton() {
  const [isOnline, setIsOnline] = useState(networkDetectionService.isConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Écouter les changements de statut réseau ──
  useEffect(() => {
    const unsubscribe = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOnline(online);
      if (online && pendingCount > 0) {
        // Retour de connexion → sync auto
        handleSync();
      }
    });
    return unsubscribe;
  }, [pendingCount]);

  // ── Charger le lastSync depuis localStorage au mount ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('academia_helm_last_sync');
      if (stored) setLastSync(new Date(stored));
    } catch {}

    // Vérifier le pendingCount dans l'outbox
    checkPendingCount();
    const interval = setInterval(checkPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkPendingCount = useCallback(async () => {
    try {
      const { outboxService } = await import('@/lib/offline/outbox.service');
      const pending = await outboxService.getPendingCount();
      setPendingCount(pending);
    } catch {
      // Outbox pas encore initialisé
    }
  }, []);

  // ── Synchronisation manuelle (pattern git pull + git push) ──
  const handleSync = async () => {
    if (!isOnline) {
      toast.info("Hors ligne", {
        description: "La synchronisation reprendra automatiquement au retour de la connexion.",
      });
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // ⭐ Pattern Git : pull + push en une seule opération
      // runSync fait : 1) PUSH (envoyer les écritures locales vers Neon)
      //                 2) PULL (récupérer les changements distants depuis Neon)
      const { syncEngine } = await import('@/lib/offline/sync-engine.service');

      // Récupérer le tenantId depuis la session
      let tenantId = '';
      try {
        const session = JSON.parse(localStorage.getItem('app_session') || '{}');
        tenantId = session?.tenant?.id || session?.tenantId || '';
      } catch {}

      if (!tenantId) {
        toast.info("Session requise", { description: "Connectez-vous pour synchroniser." });
        return;
      }

      const result = await syncEngine.runSync(tenantId);

      // Mettre à jour l'état
      setLastSync(new Date());
      setPendingCount(0);
      try { localStorage.setItem('academia_helm_last_sync', new Date().toISOString()); } catch {}

      const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: number) => a + b, 0) as number;

      if (result.pushed > 0 || totalPulled > 0) {
        toast.success("Synchronisation réussie", {
          description: `${result.pushed} envoi(s) • ${totalPulled} mise(s) à jour reçue(s)${result.conflicts > 0 ? ` • ${result.conflicts} conflit(s)` : ''}`,
        });
      } else {
        toast.success("Déjà à jour", {
          description: "Aucun changement à synchroniser.",
        });
      }

      if (result.conflicts > 0) {
        setError(`${result.conflicts} conflit(s) détecté(s)`);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Échec de synchronisation", {
        description: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Formater le temps écoulé ──
  const formatLastSync = (date: Date | null) => {
    if (!date) return "Jamais";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "À l'instant";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    return `Il y a ${diffH}h`;
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
        !isOnline
          ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
          : isSyncing
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : error
              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      )}
      title={
        !isOnline
          ? "Hors ligne — la sync reprendra à la reconnexion"
          : isSyncing
            ? "Synchronisation en cours..."
            : error
              ? `Erreur: ${error}`
              : `Dernière sync: ${formatLastSync(lastSync)} — cliquez pour synchroniser (git pull + push)`
      }
    >
      {isSyncing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : !isOnline ? (
        <CloudOff className="w-3.5 h-3.5" />
      ) : error ? (
        <AlertCircle className="w-3.5 h-3.5" />
      ) : pendingCount > 0 ? (
        <Cloud className="w-3.5 h-3.5" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}

      <span className="hidden sm:inline">
        {isSyncing
          ? "Sync..."
          : !isOnline
            ? "Hors ligne"
            : error
              ? "Erreur"
              : "Synchronisé"}
      </span>

      {/* Badge pending (écritures en attente) */}
      {pendingCount > 0 && !isSyncing && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold rounded-full bg-amber-400 text-white">
          {pendingCount}
        </span>
      )}

      {/* Badge avec le temps écoulé */}
      {!isSyncing && !error && isOnline && lastSync && (
        <span className="hidden lg:inline text-[10px] opacity-60">
          {formatLastSync(lastSync)}
        </span>
      )}
    </button>
  );
}
