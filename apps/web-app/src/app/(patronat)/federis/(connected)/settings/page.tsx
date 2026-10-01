/**
 * Page « Paramètres » — Academia Federis
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar + profil
 *    patronat) est fourni par le layout du groupe (connected) — monté UNE
 *    seule fois, persistant entre modules (fin du « jeu de défilement » de la
 *    sidebar et du rechargement du profil à chaque navigation). Cette page ne
 *    fournit plus QUE le contenu du module.
 */
import { Metadata } from 'next';
import { getServerSession } from '@/lib/auth';
import FederisSettingsPage from '@/components/federis/FederisSettingsPage';
import type { User } from '@/types';

export const metadata: Metadata = {
  title: 'Paramètres - Academia Federis',
};

export default async function SettingsRoute() {
  // Lecture locale de cookie (rapide) — le layout garantit une session valide.
  const session = await getServerSession();
  const user = (session?.user ?? null) as User | null;

  return <FederisSettingsPage tenantId={user?.tenantId ?? ''} user={user as User} />;
}
