import AcademiaLoader from '@/components/ui/AcademiaLoader';

/**
 * Chargement des pages publiques (login / inscription) — mini-spinner centré
 * sur le fond neutre Federis. Pas de shell applicatif : ces pages n'ont pas
 * de header/sidebar (interfaces publiques).
 */
export default function PageLoading() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
      <AcademiaLoader inline />
    </div>
  );
}
