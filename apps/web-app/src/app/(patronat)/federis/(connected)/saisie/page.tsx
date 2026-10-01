/**
 * Page « Saisie des notes » — Academia Federis
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar + profil
 *    patronat) est fourni par le layout du groupe (connected) — monté UNE
 *    seule fois, persistant entre modules (fin du « jeu de défilement » de la
 *    sidebar et du rechargement du profil à chaque navigation). Cette page ne
 *    fournit plus QUE le contenu du module.
 */
import { Metadata } from 'next';
import { getServerSession } from '@/lib/auth';
import FederisSaisiePage from '@/components/federis/FederisSaisiePage';
import type { User } from '@/types';

export const metadata: Metadata = {
  title: 'Saisie des notes - Academia Federis',
};

export default async function SaisieRoute() {
  // Lecture locale de cookie (rapide) — le layout garantit une session valide.
  const session = await getServerSession();
  const user = session?.user as User | undefined;

  return (
    <FederisSaisiePage userRole={user?.role ?? null} />
  );
}
