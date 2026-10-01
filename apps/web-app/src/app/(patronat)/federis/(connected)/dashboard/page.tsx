/**
 * Page « Tableau de bord » — Academia Federis
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar + profil
 *    patronat) est fourni par le layout du groupe (connected) — monté UNE
 *    seule fois, persistant entre modules (fin du « jeu de défilement » de la
 *    sidebar et du rechargement du profil à chaque navigation). Cette page ne
 *    fournit plus QUE le contenu du module.
 */
import { Metadata } from 'next';
import FederisDashboardView from '@/components/federis/FederisDashboardPage';
import type { User } from '@/types';

export const metadata: Metadata = {
  title: 'Tableau de bord - Academia Federis',
};

export default async function DashboardRoute() {
  return <FederisDashboardView />;
}
