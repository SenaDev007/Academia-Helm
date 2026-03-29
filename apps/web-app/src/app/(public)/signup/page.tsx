/**
 * Page Signup - Onboarding Wizard 4 Phases
 * 
 * Utilise le nouveau wizard d'onboarding avec :
 * 1. Informations établissement
 * 2. Informations promoteur
 * 3. Plan & Options
 * 4. Paiement initial (FedaPay)
 */

import type { Metadata } from 'next';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Créer un compte établissement',
  description:
    'Inscrivez votre établissement sur Academia Helm : informations, offre, options et paiement sécurisé pour démarrer le pilotage scolaire.',
  keywords: ['inscription Academia Helm', 'créer compte école', 'onboarding SaaS éducation'],
  path: '/signup',
});

export default function Page() {
  return <OnboardingWizard />;
}

