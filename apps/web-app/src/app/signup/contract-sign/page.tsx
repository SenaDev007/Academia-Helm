/**
 * ============================================================================
 * SIGNATURE DIFFÉRÉE DU CONTRAT D'ABONNEMENT (mode YEHI OR Tech)
 * ============================================================================
 *
 * Cette page est la cible du lien envoyé par email au promoteur lorsque la
 * signature a été différée (bouton « Signature différée » du wizard — POST
 * /api/onboarding/contract/sign avec signLater=true).
 *
 * ⭐ FIX : cette page n'existait pas (l'email pointait vers un 404). Elle
 *    recharge le draft, affiche le résumé du contrat (aligné sur ce qui a été
 *    renseigné : école, promoteur, plan, montants, paiement en espèces marqué),
 *    recueille la signature du promoteur, puis déclenche la signature finale :
 *    le backend crée le paiement CASH, active l'école via le MÊME flux que le
 *    mode self-service et envoie l'email contrat + identifiants.
 * ============================================================================
 */

import type { Metadata } from 'next';
import { ContractSignClient } from './contract-sign-client';

export const metadata: Metadata = {
  title: 'Signature du contrat — Academia Helm',
  description: "Signez électroniquement votre contrat d'abonnement Academia Helm",
  robots: { index: false, follow: false },
};

export default async function ContractSignPage({
  searchParams,
}: {
  searchParams: Promise<{ draftId?: string }>;
}) {
  const params = await searchParams;
  return <ContractSignClient draftId={params?.draftId || ''} />;
}
