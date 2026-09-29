import FederisLoadingShell from '@/components/federis/FederisLoadingShell';

/**
 * Squelette de chargement — layout COMPLET (header + sidebar + contenu).
 * Corrige la « page blanche » lors des bascules entre modules : le chrome de
 * l'application reste affiché pendant la résolution de la page serveur.
 */
export default function PageLoading() {
  return <FederisLoadingShell />;
}
