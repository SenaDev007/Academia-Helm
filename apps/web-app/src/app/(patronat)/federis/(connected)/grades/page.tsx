/**
 * Page « Notes et moyennes » — Academia Federis
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar + profil
 *    patronat) est fourni par le layout du groupe (connected) — monté UNE
 *    seule fois, persistant entre modules (fin du « jeu de défilement » de la
 *    sidebar et du rechargement du profil à chaque navigation). Cette page ne
 *    fournit plus QUE le contenu du module.
 */
import { Metadata } from 'next';
import { getServerSession } from '@/lib/auth';
import FederisGradesPage from '@/components/federis/FederisGradesPage';
import type { User } from '@/types';

export const metadata: Metadata = {
  title: 'Notes et moyennes - Academia Federis',
};

export default async function GradesRoute() {
  // Lecture locale de cookie (rapide) — le layout garantit une session valide.
  const session = await getServerSession();
  const user = session?.user as User | undefined;

  return (
    <FederisGradesPage tenantId={user?.tenantId ?? ''} userRole={user?.role ?? null} />
  );
}
