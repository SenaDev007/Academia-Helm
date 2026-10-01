import FederisContentSkeleton from '@/components/federis/FederisContentSkeleton';

/**
 * Squelette de chargement du module « Archives ».
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar) est monté par
 * le layout du groupe (connected) et PERSISTE entre les modules — ce squelette
 * ne remplace que la zone de CONTENU.
 */
export default function PageLoading() {
  return <FederisContentSkeleton />;
}
