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
import { RefreshCw, CloudOff, Check, AlertCircle, Cloud, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { networkDetectionService } from "@/lib/offline/network-detection.service";
import { setSyncModalState, addSyncOperation } from "@/components/offline/SyncModal";

export function SyncButton() {
  const [isOnline, setIsOnline] = useState(networkDetectionService.isConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

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

    // ⭐ Lire les opérations pending depuis l'outbox
    let pendingOps: any[] = [];
    try {
      const { outboxService } = await import('@/lib/offline/outbox.service');
      let tid = '';
      try {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        tid = session?.tenant?.id || session?.tenantId || '';
      } catch {}
      if (tid) pendingOps = await outboxService.getPendingEvents(tid, 50);
    } catch {}

    // ⭐ Afficher le modal avec la liste des opérations (style GitHub)
    setSyncModalState({
      isVisible: true,
      isMinimized: false, // ⭐ reset : au clic sur le bouton, le modal s'ouvre en mode full
      phase: 'push',
      message: pendingOps.length > 0 ? `Envoi de ${pendingOps.length} modification(s)...` : 'Vérification...',
      pushed: 0, pulled: 0,
      total: pendingOps.length || 1, current: 0,
      operations: pendingOps.map((op, i) => ({
        id: `push-${i}-${op.id}`,
        type: 'push' as const,
        action: (op.operationType || 'UPDATE') as 'INSERT' | 'UPDATE' | 'DELETE',
        table: op.entityType || 'unknown',
        recordId: op.entityId,
        status: 'pending' as const,
      })),
    });

    try {
      const { syncEngine } = await import('@/lib/offline/sync-engine.service');

      let tenantId = '';
      try {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        tenantId = session?.tenant?.id || session?.tenantId || '';
      } catch {}

      if (!tenantId) {
        setSyncModalState({ isVisible: false });
        toast.info("Session requise", { description: "Connectez-vous pour synchroniser." });
        return;
      }

      // ⭐ Phase PULL
      setSyncModalState({ isVisible: true, phase: 'pull', message: 'Récupération des données du serveur...' });

      const result = await syncEngine.runSync(tenantId, undefined, (current, total, currentTable, pulledSoFar) => {
        setSyncModalState({
          current,
          total,
          pulled: pulledSoFar,
          message:
            total > 0
              ? `Synchronisation : ${current} / ${total} — ${currentTable}`
              : `Synchronisation : ${currentTable}...`,
        });
      });

      // ⭐ Marquer les opérations push comme terminées
      setSyncModalState(prev => ({
        operations: prev.operations.map(op =>
          op.type === 'push' ? { ...op, status: 'success' as const } : op
        ),
      }));

      // ⭐ Ajouter les opérations pull
      const pulledTypes = Object.entries(result.pulled || {});
      for (const [table, count] of pulledTypes) {
        for (let i = 0; i < (count as number); i++) {
          addSyncOperation({
            id: `pull-${table}-${i}-${Date.now()}`,
            type: 'pull',
            action: 'UPDATE',
            table: table,
            status: 'success',
          });
        }
      }

      setLastSync(new Date());
      setPendingCount(0);
      try { localStorage.setItem('academia_helm_last_sync', new Date().toISOString()); } catch {}

      const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;

      setSyncModalState({
        isVisible: true,
        phase: 'done',
        message: `${result.pushed} envoi(s) • ${totalPulled} mise(s) à jour reçue(s)${result.conflicts > 0 ? ` • ${result.conflicts} conflit(s)` : ''}`,
        pushed: result.pushed,
        pulled: totalPulled,
        total: (pendingOps.length + totalPulled) || 1,
        current: (pendingOps.length + totalPulled) || 1,
      });

      setTimeout(() => setSyncModalState({ isVisible: false }), 3000);

      if (result.conflicts > 0) {
        setError(`${result.conflicts} conflit(s) détecté(s)`);
      }
    } catch (err: any) {
      setError(err.message);
      setSyncModalState({ isVisible: true, phase: 'error', message: err.message });
      setTimeout(() => setSyncModalState({ isVisible: false }), 5000);
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

  // ── ⭐ Push only : envoyer uniquement les modifications locales vers Neon ──
  const handlePushOnly = async () => {
    setShowMenu(false);
    if (!isOnline) {
      toast.info("Hors ligne", {
        description: "Impossible d'envoyer les données sans connexion.",
      });
      return;
    }
    if (pendingCount === 0) {
      toast.info("Rien à envoyer", {
        description: "Aucune modification en attente.",
      });
      return;
    }

    setIsPushing(true);
    setError(null);

    try {
      const { syncEngine } = await import('@/lib/offline/sync-engine.service');
      let tenantId = '';
      try {
        const session = JSON.parse(localStorage.getItem('session') || '{}');
        tenantId = session?.tenant?.id || session?.tenantId || '';
      } catch {}

      if (!tenantId) {
        toast.info("Session requise", { description: "Connectez-vous pour envoyer." });
        return;
      }

      setSyncModalState({
        isVisible: true,
        isMinimized: false,
        phase: 'push',
        message: `Envoi de ${pendingCount} modification(s)...`,
        pushed: 0, pulled: 0,
        total: pendingCount, current: 0,
        operations: [],
      });

      const result = await syncEngine.pushOutbox(tenantId);

      setPendingCount(0);
      setSyncModalState({
        isVisible: true,
        phase: 'done',
        message: `${result.pushed} modification(s) envoyée(s)${result.conflicts > 0 ? ` • ${result.conflicts} conflit(s)` : ''}`,
        pushed: result.pushed,
        pulled: 0,
        total: pendingCount,
        current: pendingCount,
      });

      setTimeout(() => setSyncModalState({ isVisible: false }), 3000);

      if (result.pushed > 0) {
        toast.success("Modifications envoyées", {
          description: `${result.pushed} modification(s) poussée(s) vers le serveur.`,
        });
      }
    } catch (err: any) {
      setError(err.message);
      setSyncModalState({ isVisible: true, phase: 'error', message: err.message });
      setTimeout(() => setSyncModalState({ isVisible: false }), 5000);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* ⭐ Bouton principal : Synchroniser (pull + push) */}
      <button
        onClick={handleSync}
        disabled={isSyncing || isPushing}
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all border shrink-0",
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
                : `Synchronisé — dernière sync: ${formatLastSync(lastSync)}${pendingCount > 0 ? ` · ${pendingCount} en attente` : ''} — cliquez pour relancer`
        }
      >
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : !isOnline ? (
          <CloudOff className="w-3.5 h-3.5" />
        ) : error ? (
          <AlertCircle className="w-3.5 h-3.5" />
        ) : pendingCount > 0 ? (
          <span className="relative">
            <Cloud className="w-3.5 h-3.5" />
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] font-bold rounded-full bg-amber-400 text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </span>
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>

      {/* ⭐ Bouton "Push only" — visible quand il y a des modifications en attente */}
      {pendingCount > 0 && (
        <button
          onClick={handlePushOnly}
          disabled={isSyncing || isPushing || !isOnline}
          className={cn(
            "inline-flex items-center justify-center h-8 px-2 rounded-lg transition-all border shrink-0 text-xs font-semibold gap-1",
            isPushing
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
          )}
          title="Envoyer mes modifications vers le serveur (push only — sans télécharger les mises à jour)"
        >
          {isPushing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CloudUpload className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Envoyer</span>
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold rounded-full bg-amber-400 text-white">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        </button>
      )}
    </div>
  );
}
