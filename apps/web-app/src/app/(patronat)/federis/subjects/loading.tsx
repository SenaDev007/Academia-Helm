import FederisLoadingShell from '@/components/federis/FederisLoadingShell';

/**
 * Squelette de chargement — module « Matières ».
 * Corrige la « page blanche » lors de la bascule vers ce module : le chrome
 * de l'application (header + sidebar) reste affiché pendant que la page
 * serveur (session + profil) se résout.
 */
export default function PageLoading() {
  return <FederisLoadingShell />;
}
