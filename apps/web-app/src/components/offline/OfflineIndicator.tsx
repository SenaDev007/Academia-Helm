/**
 * Offline Indicator Component
 * 
 * Composant pour afficher l'état de connexion et la synchronisation
 */

'use client';

import { useOffline, useSyncStatus } from '@/hooks/useOffline';
import { WifiOff, Wifi, RefreshCw, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const isOnline = useOffline();
  const { isSyncing, pendingCount, lastSync } = useSyncStatus();
  const [showConflict, setShowConflict] = useState(false);

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

  if (isOnline && !isSyncing && pendingCount === 0 && !showConflict) {
    return null; // Tout est OK, ne rien afficher
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

      {/* Indicateur Événements en attente */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <div className="bg-yellow-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-[300px]">
          <Wifi className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Synchronisation en attente</p>
            <p className="text-xs opacity-90">
              {pendingCount} événement{pendingCount > 1 ? 's' : ''} à synchroniser
            </p>
          </div>
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

