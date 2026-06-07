/**
 * Offline Indicator Component
 * 
 * Composant pour afficher l'état de connexion et la synchronisation
 * - Auto-nettoyage des événements obsolètes au montage
 * - Bouton "Effacer" pour forcer la réinitialisation du badge
 */

'use client';

import { useOffline, useSyncStatus } from '@/hooks/useOffline';
import { WifiOff, Wifi, RefreshCw, CheckCircle, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { outboxService } from '@/lib/offline/outbox.service';

function getTenantId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  if (match) return decodeURIComponent(match[1]);
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.tenantId || parsed.tenant?.id || null;
    }
  } catch {}
  return null;
}

export default function OfflineIndicator() {
  const isOnline = useOffline();
  const { isSyncing, pendingCount, lastSync } = useSyncStatus();
  const [showConflict, setShowConflict] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-nettoyage des événements obsolètes au montage
  useEffect(() => {
    const cleanup = async () => {
      const tenantId = getTenantId();
      if (!tenantId) return;
      try {
        // Supprimer les événements déjà synchronisés ou échoués trop de fois
        const cleaned = await outboxService.clearStaleEvents(tenantId);
        if (cleaned > 0) {
          console.log(`[OfflineIndicator] Auto-cleaned ${cleaned} stale sync events`);
        }
      } catch (err) {
        console.warn('[OfflineIndicator] Cleanup failed:', err);
      }
    };
    cleanup();
  }, []);

  useEffect(() => {
    const handleConflict = (event: CustomEvent) => {
      setShowConflict(true);
      setTimeout(() => setShowConflict(false), 5000);
    };

    if (typeof window === 'undefined') return;

    window.addEventListener('sync-conflict', handleConflict as EventListener);
    return () => {
      window.removeEventListener('sync-conflict', handleConflict as EventListener);
    };
  }, []);

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    const tenantId = getTenantId();
    if (!tenantId) { setIsClearing(false); return; }
    try {
      const count = await outboxService.clearAllEvents(tenantId);
      console.log(`[OfflineIndicator] Cleared ${count} sync events`);
      setDismissed(true);
      // Dispatcher un événement pour forcer la mise à jour du compteur
      window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: true, total: 0 } }));
    } catch (err) {
      console.error('[OfflineIndicator] Clear failed:', err);
    } finally {
      setIsClearing(false);
    }
  }, []);

  // Si tout est OK, ne rien afficher
  if (isOnline && !isSyncing && pendingCount === 0 && !showConflict) {
    return null;
  }

  // Si le badge a étédismissé et qu'on est en ligne sans sync en cours
  if (dismissed && isOnline && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Indicateur Offline */}
      {!isOnline && (
        <div className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <WifiOff className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Mode hors ligne</p>
            <p className="text-xs opacity-90">
              Synchronisation automatique à la reconnexion
            </p>
          </div>
        </div>
      )}

      {/* Indicateur Synchronisation */}
      {isOnline && isSyncing && (
        <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Synchronisation en cours...</p>
            <p className="text-xs opacity-90">
              {pendingCount} événement{pendingCount > 1 ? 's' : ''} en attente
            </p>
          </div>
        </div>
      )}

      {/* Indicateur Événements en attente — avec bouton Effacer */}
      {isOnline && !isSyncing && pendingCount > 0 && !dismissed && (
        <div className="bg-yellow-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <Wifi className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Synchronisation en attente</p>
            <p className="text-xs opacity-90">
              {pendingCount} événement{pendingCount > 1 ? 's' : ''} à synchroniser
            </p>
          </div>
          <button
            onClick={handleClear}
            disabled={isClearing}
            className="shrink-0 rounded-md bg-white/20 hover:bg-white/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Effacer les événements en attente"
          >
            {isClearing ? '...' : 'Effacer'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-md hover:bg-white/20 p-1 transition-colors"
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Indicateur Conflit */}
      {showConflict && (
        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Conflit résolu</p>
            <p className="text-xs opacity-90">
              La version serveur a été appliquée
            </p>
          </div>
        </div>
      )}

      {/* Indicateur Dernière Sync */}
      {isOnline && !isSyncing && pendingCount === 0 && lastSync && (
        <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Synchronisé</p>
            <p className="text-xs opacity-90">
              Dernière sync : {new Date(lastSync).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
