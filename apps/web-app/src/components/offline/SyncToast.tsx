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
  /** ⭐ Événements restés EN FILE (serveur injoignable / 5xx transitoire) —
   *    ce n'est PAS un échec : nouvelle tentative automatique au cycle 30 s. */
  pending?: number;
  /** ⭐ Marqué transitoire par l'orchestrateur (offline-sync.service) :
   *    panne serveur/réseau — aucune donnée perdue, retry automatique. */
  transient?: boolean;
}

/** ⭐ Anti-spam : délai minimum entre deux toasts d'ERREUR identiques.
 *    Avant, une panne serveur provoquait un toast « Échec de synchronisation »
 *    à chaque retry (cycle 30 s + Background Sync + retour de connexion) —
 *    l'utilisateur voyait « échec, échec… » en boucle alors que ses données
 *    étaient saines et simplement en attente. */
const ERROR_TOAST_COOLDOWN_MS = 90 * 1000;
let lastErrorToastAt = 0;
let lastErrorMessage = '';

export function SyncToast() {
  const { error } = useOfflineSync();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const handleSyncEnd = (event: CustomEvent) => {
      const detail = event.detail as SyncResult;
      const pending = Number(detail?.pending) || 0;
      const failed = Number(detail?.failed) || 0;
      const conflicted = Number(detail?.conflicted) || 0;

      // ⭐ TRANSITOIRE (encore en file et/ou flag transitoire, AUCUN échec
      //    définitif) : PAS de toast. La pastille de synchronisation informe
      //    déjà (« Envoi de N modification(s)… ») et une nouvelle tentative
      //    automatique aura lieu au cycle de 30 s / au prochain retour du
      //    réseau. C'était le cœur du bug « ça toast échec de synchronisation
      //    et ça a encore relancé » : chaque retry transitoire était affiché
      //    comme une ERREUR.
      if ((pending > 0 || detail?.transient === true) && failed === 0 && conflicted === 0) {
        return;
      }

      setSyncResult({
        success: detail?.success ?? false,
        total: detail?.total,
        successful: detail?.successful,
        conflicted: detail?.conflicted,
        failed: detail?.failed,
        pending,
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
    // ⭐ Cooldown anti-spam : la même erreur n'est pas re-toastée pendant 90 s.
    const now = Date.now();
    if (error === lastErrorMessage && now - lastErrorToastAt < ERROR_TOAST_COOLDOWN_MS) {
      return null;
    }
    lastErrorToastAt = now;
    lastErrorMessage = error;
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
      // ⭐ Cooldown : sans ça, une panne serveur → un toast toutes les 30 s.
      const now = Date.now();
      const msg =
        syncResult.failed
          ? `${syncResult.failed} action${syncResult.failed > 1 ? 's' : ''} ont échoué`
          : 'Veuillez réessayer plus tard';
      if (msg === lastErrorMessage && now - lastErrorToastAt < ERROR_TOAST_COOLDOWN_MS) {
        return null;
      }
      lastErrorToastAt = now;
      lastErrorMessage = msg;
      message = msg;
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
