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
 * ⭐ T31 — la page portait le header Academia AU-DESSUS du bandeau patronat.
 * ⭐ T38 — le header Academia est SUPPRIMÉ (retour promoteur) : la page
 *   commence directement par le BANDEAU INSTITUTIONNEL DU PATRONAT (logo
 *   réel + nom, récupérés de la base). Le spacer du layout public (h-14
 *   md:h-16, réservé au header fixe) est compensé par une marge négative
 *   pour que le bandeau patronat colle au sommet de l'écran.
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
  return (
    <div className="min-h-screen bg-white">
      {/* ⭐ T38 — plus de header Academia sur cette page : le bandeau du
      patronat (dans FederisPublicResultsClient) ouvre directement la page.
      Le spacer h-14 md:h-16 du layout (public) est annulé par cette marge
      négative pour un rendu bord à bord. */}
      <div className="-mt-14 md:-mt-16">
        <FederisPublicResultsClient token={token} />
      </div>
    </div>
  );
}
