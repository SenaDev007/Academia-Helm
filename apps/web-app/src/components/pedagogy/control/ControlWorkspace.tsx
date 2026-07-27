/**
 * ============================================================================
 * CONTROL WORKSPACE - MODULE PÉDAGOGIE (Validation Direction)
 * ============================================================================
 *
 * Affiche directement DirectorPedagogyControl (sans en-tête superflu).
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { DirectorPedagogyControl } from '../production/DirectorPedagogyControl';
import { AlertTriangle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { networkDetectionService } from '@/lib/offline/network-detection.service';

export default function ControlWorkspace() {
  const { academicYear, tenant } = useModuleContext();
  const { user } = useAppSession();
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const cleanup = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOffline(!online);
    });
    setIsOffline(!networkDetectionService.isConnected());
    return cleanup;
  }, []);

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Chargement de l'année académique…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      {isOffline && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <p className="text-sm font-medium">
            Vous êtes en mode hors ligne. Certaines données peuvent ne pas être à jour.
          </p>
        </div>
      )}

      <DirectorPedagogyControl
        key={refreshKey}
        tenantId={tenant?.id || ''}
        academicYearId={academicYear?.id || ''}
        userId={user?.id || ''}
      />
    </div>
  );
}
