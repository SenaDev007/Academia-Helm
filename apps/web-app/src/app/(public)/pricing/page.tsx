/**
 * Page Pricing publique (/pricing)
 * Alignée sur la spec HELM Pricing Landing Page.
 */

import type { Metadata } from 'next';
import PremiumHeader from '@/components/layout/PremiumHeader';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Tarifs et offres',
  description:
    'Découvrez les offres Academia Helm : 9 modules inclus, tarification claire selon le nombre d’élèves. Pilotez votre établissement sans surprise.',
  keywords: ['tarifs Academia Helm', 'prix logiciel école', 'abonnement gestion scolaire', 'SaaS éducation'],
  path: '/pricing',
});
import HelmPricingGrid from '@/components/pricing/HelmPricingGrid';
import HelmModulesSection from '@/components/pricing/HelmModulesSection';
import HelmAddonsSection from '@/components/pricing/HelmAddonsSection';

export default function Page() {
  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      <main className="px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        <section className="max-w-4xl mx-auto text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-bold text-navy-900 mb-4">
            Pilotez votre école avec Academia Helm
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-4">
            Tout inclus. Un seul prix. Zéro surprise.
          </p>
          <p className="text-sm md:text-base text-slate-600 max-w-3xl mx-auto">
            Les 9 modules complets dans chaque plan — élèves, finances, IA ORION,
            bulletins, RH, QHSE, communication et modules complémentaires. La seule
            variable est le nombre d&apos;élèves dans votre établissement.
          </p>
        </section>

        <section className="max-w-6xl mx-auto">
          <HelmPricingGrid />
          <HelmModulesSection />
          <HelmAddonsSection />
        </section>
      </main>
    </div>
  );
}

