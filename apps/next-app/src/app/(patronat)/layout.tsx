/**
 * Layout Patronat
 * 
 * Layout pour toutes les pages /patronat/*
 * Utilise PatronatHeader pour les pages marketing
 * Utilise PatronatLayout pour les pages connectées
 */

import { ReactNode } from 'react';

export default function PatronatLayoutGroup({
  children,
}: {
  children: ReactNode;
}) {
  // Ce layout est minimal car :
  // - Les pages marketing utilisent PatronatHeader directement
  // - Les pages connectées utilisent PatronatLayout qui inclut son propre header
  return <>{children}</>;
}

