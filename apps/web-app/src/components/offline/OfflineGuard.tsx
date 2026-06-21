/**
 * Offline Guard Component
 *
 * ⚠️ DÉSACTIVÉ TEMPORAIREMENT — Le mode offline bloquait l'application
 * même quand la connexion était juste instable.
 *
 * Ce composant retourne maintenant simplement les children sans aucune
 * vérification. Il sera réactivé quand le mode offline sera réimplémenté
 * correctement.
 */

'use client';

import { ReactNode } from 'react';

interface OfflineGuardProps {
  children: ReactNode;
}

export default function OfflineGuard({ children }: OfflineGuardProps) {
  // ⚠️ Mode offline désactivé — toujours laisser passer
  return <>{children}</>;
}
