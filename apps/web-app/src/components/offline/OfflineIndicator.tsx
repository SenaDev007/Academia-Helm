/**
 * Offline Indicator — compact & discret
 *
 * Petit badge flottant en bas à droite (comme Discord/Slack).
 * Non-bloquant, esthétique, n'occupe pas toute la largeur.
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

  if (isOnline) return null;

  const handleRetry = async () => {
    setChecking(true);
    const online = await networkDetectionService.checkConnection();
    if (online) setIsOnline(true);
    setChecking(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-amber-500 text-white rounded-full shadow-lg flex items-center gap-2 pl-3 pr-2 py-1.5">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="text-xs font-bold whitespace-nowrap">Hors ligne</span>
      <button
        onClick={handleRetry}
        disabled={checking}
        className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
      >
        {checking ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      </button>
    </div>
  );
}
