'use client';

/**
 * ============================================================================
 * PORTAIL SECRETAIRE-COMPTABLE — ACCUEIL (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du secrétaire-comptable (/app/secretaire-comptable).
 * Le quotidien du secrétaire-comptable est l'ENCAISSEMENT des frais de
 * scolarité : l'accueil du portail est l'outil Encaissements (composant
 * partagé TransactionsContent — le même que /app/finance/payments, zéro
 * duplication), rendu dans le shell secrétaire-comptable (AdminPortalShell,
 * accent emerald).
 *
 * Optimisé avec lazy loading — pattern identique à /app/students/page.tsx.
 * Client Component requis (Next 16 : `dynamic` + `ssr: false` interdit dans
 * les RSC).
 * ============================================================================
 */

import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/feedback/LoadingState';

// ✅ Lazy load du composant lourd pour améliorer le temps de chargement initial
const TransactionsContent = dynamic(
  () => import('@/components/finance/TransactionsContent'),
  {
    loading: () => <LoadingState message="Chargement des encaissements..." />,
    ssr: false, // ✅ Désactiver SSR pour les composants lourds côté client
  }
);

export default function SecretaryAccountantHomePage() {
  return <TransactionsContent />;
}
