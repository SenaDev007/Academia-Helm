import FederisContentSkeleton from '@/components/federis/FederisContentSkeleton';

/**
 * Squelette de chargement PARTAGÉ du groupe (connected) — filet de sécurité.
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar) est monté par
 * le layout du groupe et PERSISTE entre les modules. La frontière Suspense ne
 * remplace donc QUE la zone de contenu — plus de clone complet de la sidebar
 * (cause du « jeu de défilement » à chaque changement de module).
 *
 * Chaque module garde son loading.tsx dédié (frontière la plus proche =
 * prioritaire) ; ce filet attrape tout module présent ou futur qui en serait
 * dépourvu.
 */
export default function FederisConnectedFallbackLoading() {
  return <FederisContentSkeleton />;
}
