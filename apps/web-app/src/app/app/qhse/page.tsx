/**
 * ============================================================================
 * QHSE PAGE (QUALITÉ, HYGIÈNE, SÉCURITÉ, ENVIRONNEMENT)
 * ============================================================================
 */

import QHSEModulePage from '@/components/pilotage/modules/QHSEModulePage';

export const metadata = {
  title: 'QHSE | Academia Helm',
  description: 'Gestion de la qualité, de l\'hygiène, de la sécurité et de l\'environnement scolaire.',
};

export default function QHSEPage() {
  return <QHSEModulePage />;
}
