import AcademiaLoader from '@/components/ui/AcademiaLoader';

/**
 * Chargement de la page publique de paiement — mini-spinner centré sur le
 * fond neutre Federis (pattern pages publiques : checkout n'a pas de
 * sidebar applicative, son header public reste géré par la page).
 */
export default function PageLoading() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
      <AcademiaLoader inline />
    </div>
  );
}
