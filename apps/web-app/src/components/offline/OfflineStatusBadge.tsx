/**
 * OfflineStatusBadge Component
 * 
 * Composant pour afficher le statut offline/online
 * avec indicateur d'actions en attente et bouton de synchronisation
 */

'use client';

import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Clock, RefreshCw, Loader2 } from 'lucide-react';

/**
 * Badge de statut offline/online avec synchronisation
 */
export function OfflineStatusBadge() {
  const { isOnline, pendingOperationsCount, isSyncing, syncNow, lastSyncAt } = useOfflineSync();

  return (
    <div className="fixed top-4 right-4 flex flex-col items-end gap-1 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        {isSyncing ? (
          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Synchronisation…
          </Badge>
        ) : !isOnline ? (
          <>
            <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">
              <WifiOff className="w-3 h-3 mr-1" />
              Hors ligne
            </Badge>
            {pendingOperationsCount > 0 && (
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                <Clock className="w-3 h-3 mr-1" />
                {pendingOperationsCount} en attente
              </Badge>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={syncNow}
              disabled={pendingOperationsCount === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Synchroniser
            </Button>
          </>
        ) : (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <Wifi className="w-3 h-3 mr-1" />
            Connecté
          </Badge>
        )}
      </div>
      {/* Historique : Dernière sync + opérations en attente (spec UX) */}
      {(lastSyncAt || pendingOperationsCount > 0) && (
        <span className="text-xs text-gray-500">
          {lastSyncAt && <>Dernière sync : {new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>}
          {lastSyncAt && pendingOperationsCount > 0 && ' · '}
          {pendingOperationsCount > 0 && `${pendingOperationsCount} en attente`}
        </span>
      )}
    </div>
  );
}
