import FederisLoadingShell from '@/components/federis/FederisLoadingShell';

/**
 * Squelette de chargement — UI « Saisie des notes » des secrétaires
 * (le chrome header + sidebar reste affiché pendant la résolution serveur).
 */
export default function PageLoading() {
  return <FederisLoadingShell />;
}
