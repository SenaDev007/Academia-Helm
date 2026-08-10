/**
 * Offline Guard Component — RÉACTIVÉ
 *
 * Non-bloquant : affiche les children + l'OfflineIndicator (bannière orange).
 * L'utilisateur peut continuer à utiliser l'app en offline (lecture depuis
 * le cache IndexedDB, écritures dans l'outbox).
 *
 * Au lieu de bloquer l'accès, on affiche juste la bannière + le badge.
 */

'use client';

import { ReactNode } from 'react';
import OfflineIndicator from './OfflineIndicator';

interface OfflineGuardProps {
  children: ReactNode;
}

export default function OfflineGuard({ children }: OfflineGuardProps) {
  return (
    <>
      <OfflineIndicator />
      {children}
    </>
  );
}
