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
 * ⭐ T31 — la page porte désormais les DEUX en-têtes institutionnels :
 *   1. le HEADER ACADEMIA (corporate Academia Helm, header-1, fixed) ;
 *   2. le HEADER DU PATRONAT (bandeau navy du portail, conservé, avec le
 *      LOGO RÉEL du patronat récupéré de la base — plus d'icône générique).
 *
 * ⭐ T33 — le header Academia est FORCÉ (forceAcademiaBrand) : le lien public
 * est partagé aux parents avec l’origine du sous-domaine du patronat
 * (window.location.origin à la génération) ; sans cette prop, le composant
 * Header détecterait le sous-domaine tenant et remplacerait logo + wordmark
 * par le branding de l’école du patronat. Cette page porte TOUJOURS le header
 * de la plateforme Academia Helm — l’identité du patronat reste portée par le
 * bandeau institutionnel dédié du portail (logo réel + nom, cf. T31).
 *
 * ⚠️ noindex : les résultats d'élèves ne doivent JAMAIS être indexés par les
 * moteurs de recherche (données personnelles + lien provisoire à diffusion
 * contrôlée).
 * ============================================================================
 */

import type { Metadata } from 'next';
import { Header } from '@/components/ui/header-1';
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
      {/* ⭐ T31 — Header ACADEMIA (corporate Helm, fixed top-0, h-14 md:h-16).
      Le layout (public) réserve déjà l'espacement correspondant — la page a
      désormais le header Academia AU-DESSUS du bandeau patronat du portail.
      ⭐ T33 — forceAcademiaBrand : le lien est ouvert depuis le sous-domaine
      du patronat, mais cette page garde le header de la PLATEFORME Academia
      Helm (logo + wordmark) — pas le branding du sous-domaine tenant. */}
      <Header forceAcademiaBrand />
      <FederisPublicResultsClient token={token} />
    </div>
  );
}
