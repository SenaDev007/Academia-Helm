/**
 * Offline Status Badge — RÉACTIVÉ
 *
 * Petit badge rond dans la barre supérieure qui montre le statut réseau.
 * Vert = en ligne, Orange = hors ligne (avec compteur de pending dans l'outbox).
 */

'use client';

import { useState, useEffect } from 'react';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState(networkDetectionService.isConnected());

  useEffect(() => {
    const unsubscribe = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors',
        isOnline
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      )}
      title={isOnline ? 'En ligne' : 'Hors ligne — sync en attente'}
    >
      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      <span className="hidden sm:inline">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
    </div>
  );
}
