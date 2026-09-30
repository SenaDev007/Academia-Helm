/**
 * ============================================================================
 * Page publique de consultation des résultats — /federis/resultats/[token]
 * ============================================================================
 * ⭐ T26 (2026-10-01) — Lien provisoire publié par le patronat (Academia
 * Federis) lors de la publication officielle des résultats : les PARENTS
 * consultent SANS COMPTE le résultat de leur enfant (recherche par nom,
 * numéro de table ou matricule) avec récapitulatif des notes, moyenne et
 * décision finale (Admis / Ajourné).
 *
 * Le lien a une durée de vie paramétrable par le patronat et peut être
 * révoqué à tout moment (module Délibération) — cette page sert le portail
 * client correspondant (FederisPublicResultsClient).
 *
 * ⚠️ noindex : les résultats d'élèves ne doivent JAMAIS être indexés par les
 * moteurs de recherche (données personnelles + lien provisoire à diffusion
 * contrôlée).
 * ============================================================================
 */

import type { Metadata } from 'next';
import FederisPublicResultsClient from '@/components/public/FederisPublicResultsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Consultation des résultats — Academia Federis',
  description:
    'Consultation officielle et provisoire des résultats d’examen publiés par le patronat : recherchez un candidat par nom, matricule ou numéro de table.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function FederisPublicResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <FederisPublicResultsClient token={token} />;
}
