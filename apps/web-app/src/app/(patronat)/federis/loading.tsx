import FederisLoadingShell from '@/components/federis/FederisLoadingShell';

/**
 * Squelette de chargement PARTAGÉ de l'espace /federis (filet de sécurité).
 *
 * Frontière Suspense de dernier recours pour tout module Federis qui n'a pas
 * son propre loading.tsx : le chrome complet (header + sidebar + squelette
 * de contenu) reste affiché pendant la résolution de la page serveur —
 * l'utilisateur ne voit JAMAIS une page blanche ou le loader plein écran
 * racine lors d'un changement de module.
 */
export default function FederisFallbackLoading() {
  return <FederisLoadingShell />;
}
