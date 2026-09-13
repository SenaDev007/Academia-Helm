/**
 * Offline Guard Component — RÉACTIVÉ
 *
 * Non-bloquant : affiche les children + l'OfflineIndicator (bannière orange).
 * L'utilisateur peut continuer à utiliser l'app en offline (lecture depuis
 * le cache IndexedDB, écritures dans l'outbox).
 *
 * Au lieu de bloquer l'accès, on affiche juste la bannière + le badge.
 * Les erreurs réseau sont interceptées et ignorées silencieusement —
 * l'utilisateur ne voit JAMAIS "Connexion impossible" ou "Pas de connexion Internet".
 */

'use client';

import { ReactNode, useEffect } from 'react';
import OfflineIndicator from './OfflineIndicator';
import OfflineReadinessIndicator from './OfflineReadinessIndicator';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { toast } from 'sonner';

interface OfflineGuardProps {
  children: ReactNode;
}

export default function OfflineGuard({ children }: OfflineGuardProps) {
  useEffect(() => {
    // ⭐ Intercepter les erreurs réseau globales et les ignorer silencieusement
    //    quand on est hors ligne — l'utilisateur ne doit jamais voir
    //    "Connexion impossible" ou "Pas de connexion Internet"
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason?.isOffline || (reason?.message && (
        reason.message.includes('Connexion indisponible') ||
        reason.message.includes('Network Error') ||
        reason.message.includes('ERR_NETWORK') ||
        reason.message.includes('fetch')
      ))) {
        // Empêcher l'affichage de l'erreur dans la console
        event.preventDefault();
      }
    };

    // ⭐ Intercepter les toasts d'erreur réseau
    //    Restauration : on sauvegarde la fonction originale et on la restaure
    //    dans le cleanup pour éviter de surcharger toast.error définitivement.
    const originalToastError = toast.error;
    toast.error = (msg: string, opts?: any) => {
      // Si on est offline et que le message parle de connexion, ne pas afficher
      if (!networkDetectionService.isConnected() && (
        msg.includes('Connexion') ||
        msg.includes('connexion') ||
        msg.includes('réseau') ||
        msg.includes('Erreur réseau') ||
        msg.includes('erreur réseau') ||
        msg.includes('Failed to fetch')
      )) {
        return;
      }
      return originalToastError(msg, opts);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // ⭐ Restaurer toast.error original pour éviter de surcharger définitivement
      toast.error = originalToastError;
    };
  }, []);

  return (
    <>
      <OfflineIndicator />
      {/* ⭐ v4.1.0 — Indicateur de préparation hors ligne : pill de
          progression + toast vert « vous pouvez couper votre connexion » */}
      <OfflineReadinessIndicator />
      {children}
    </>
  );
}
