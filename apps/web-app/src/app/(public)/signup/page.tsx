/**
 * Page Signup - Onboarding Wizard 4 Phases
 *
 * Utilise le wizard d'onboarding avec :
 * 1. Informations établissement
 * 2. Informations promoteur
 * 3. Plan & Options (plans dynamiques depuis pricing_plans)
 * 4. Paiement initial (FeexPay)
 *
 * Layout : Header public + Footer public de Academia Helm
 */

import type { Metadata } from 'next';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { generateSEOMetadata } from '@/lib/seo';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Créer un compte établissement',
  description:
    'Inscrivez votre établissement sur Academia Helm : informations, offre, options et paiement sécurisé pour démarrer le pilotage scolaire.',
  keywords: ['inscription Academia Helm', 'créer compte école', 'onboarding SaaS éducation'],
  path: '/signup',
});

export default function Page() {
  return (
    <>
      <Header />
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <OnboardingWizard />
      </main>
      <Footer2 />
    </>
  );
}
