/**
 * Page « Rapports et statistiques » — Academia Federis
 *
 * ⭐ Layout partagé (2026-10-01) : le chrome (header + sidebar + profil
 *    patronat) est fourni par le layout du groupe (connected) — monté UNE
 *    seule fois, persistant entre modules (fin du « jeu de défilement » de la
 *    sidebar et du rechargement du profil à chaque navigation). Cette page ne
 *    fournit plus QUE le contenu du module.
 */
import { Metadata } from 'next';
import FederisReportsPage from '@/components/federis/FederisReportsPage';
// ⭐ 2026-10-02 — Vue par département : le national choisit un département
//    (grille de cartes) avant de consulter les rapports du module.
import FederisDepartmentGate from '@/components/federis/FederisDepartmentGate';
import type { User } from '@/types';

export const metadata: Metadata = {
  title: 'Rapports et statistiques - Academia Federis',
};

export default async function ReportsRoute() {
  return (
    <FederisDepartmentGate moduleName="Rapports et statistiques">
      <FederisReportsPage />
    </FederisDepartmentGate>
  );
}
