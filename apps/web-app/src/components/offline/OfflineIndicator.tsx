/**
 * Offline Indicator — RÉACTIVÉ
 *
 * Bannière orange fixe en haut de l'écran quand l'utilisateur est hors ligne.
 * Non-bloquante : l'utilisateur peut continuer à utiliser l'app (lecture depuis
 * le cache IndexedDB, écritures dans l'outbox).
 */

'use client';

import { useState, useEffect } from 'react';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(networkDetectionService.isConnected());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  // ⭐ Ne rien afficher si on est online
  if (isOnline) return null;

  const handleRetry = async () => {
    setChecking(true);
    const online = await networkDetectionService.checkConnection();
    if (online) setIsOnline(true);
    setChecking(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold">
          Vous êtes hors ligne — Les données seront synchronisées à la reconnexion
        </span>
      </div>
      <button
        onClick={handleRetry}
        disabled={checking}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
      >
        {checking ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Réessayer
      </button>
    </div>
  );
}
