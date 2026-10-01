/**
 * Page « Archives » — Academia Federis
 *
 * ⭐ 2026-10-01 — Module d'archivage de fin d'année : un dossier par année
 *    scolaire, consultable module par module (lecture seule + exports).
 *    Le chrome (header + sidebar + profil patronat) est fourni par le layout
 *    partagé du groupe (connected).
 */
import { Metadata } from 'next';
import FederisArchivesPage from '@/components/federis/FederisArchivesPage';

export const metadata: Metadata = {
  title: 'Archives - Academia Federis',
};

export default function ArchivesRoute() {
  return <FederisArchivesPage />;
}
