/**
 * SyncToast Component
 * 
 * Composant de notification toast pour les résultats de synchronisation
 */

'use client';

import { useEffect, useState } from 'react';
import { Toast, ToastVariant } from '@/components/ui/toast';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export interface SyncResult {
  success: boolean;
  total?: number;
  successful?: number;
  conflicted?: number;
  failed?: number;
}

export function SyncToast() {
  const { error } = useOfflineSync();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const handleSyncEnd = (event: CustomEvent) => {
      const detail = event.detail as SyncResult;
      setSyncResult({
        success: detail?.success ?? false,
        total: detail?.total,
        successful: detail?.successful,
        conflicted: detail?.conflicted,
        failed: detail?.failed,
      });
      setShowToast(true);
    };

    if (typeof window === 'undefined') return;

    window.addEventListener('sync-end', handleSyncEnd as EventListener);
    return () => {
      window.removeEventListener('sync-end', handleSyncEnd as EventListener);
    };
  }, []);

  // Toast d'erreur si erreur présente
  useEffect(() => {
    if (error) {
      setShowToast(true);
    }
  }, [error]);

  if (!showToast || (!syncResult && !error)) {
    return null;
  }

  let variant: ToastVariant = 'info';
  let title = '';
  let message = '';

  if (error) {
    variant = 'error';
    title = 'Erreur de synchronisation';
    message = error || 'Veuillez réessayer plus tard';
  } else if (syncResult) {
    if (syncResult.success && (syncResult.conflicted ?? 0) === 0 && (syncResult.failed ?? 0) === 0) {
      // Succès complet
      variant = 'success';
      title = 'Synchronisation réussie';
      message =
        syncResult.successful && syncResult.successful > 0
          ? `${syncResult.successful} action${syncResult.successful > 1 ? 's' : ''} synchronisée${syncResult.successful > 1 ? 's' : ''}`
          : 'Toutes vos actions ont été synchronisées';
    } else if (syncResult.conflicted && syncResult.conflicted > 0) {
      // Conflits
      variant = 'warning';
      title = 'Conflits détectés';
      message = `${syncResult.conflicted} action${syncResult.conflicted > 1 ? 's' : ''} nécessite${syncResult.conflicted > 1 ? 'nt' : ''} votre attention`;
    } else {
      // Erreur partielle
      variant = 'error';
      title = 'Erreur de synchronisation';
      message = syncResult.failed ? `${syncResult.failed} action${syncResult.failed > 1 ? 's' : ''} ont échoué` : 'Veuillez réessayer plus tard';
    }
  }

  return (
    <Toast
      variant={variant}
      title={title}
      message={message}
      duration={variant === 'success' ? 3000 : 5000}
      autoClose={true}
      onClose={() => {
        setShowToast(false);
        setSyncResult(null);
      }}
      onRemove={() => {}}
    />
  );
}
