/**
 * Version anglaise (entrée SEO / hreflang). Contenu synthétique ; à enrichir ou rediriger vers un domaine EN dédié via NEXT_PUBLIC_HREFLANG_EN_URL.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';
import { getPublicSiteUrl, DEFAULT_OG_IMAGE_PATH } from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: 'Academia Helm — School operations platform',
  description:
    'Unified school management: students, finance, pedagogy, ORION AI insights. Built for demanding institutions in West Africa and beyond.',
  openGraph: {
    title: 'Academia Helm — School operations platform',
    description: 'Unified school management for modern institutions.',
    url: `${siteUrl}/en`,
    siteName: 'Academia Helm',
    locale: 'en_US',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630, alt: 'Academia Helm' }],
  },
  alternates: {
    canonical: `${siteUrl}/en`,
    languages: buildHreflangLanguages(siteUrl, '/en'),
  },
};

export default function EnglishLandingEntryPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PremiumHeader />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <p className="text-sm font-semibold text-[#0b2f73] uppercase tracking-wide mb-3">English</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0b2f73] mb-6">
          Academia Helm — your institution&apos;s digital cockpit
        </h1>
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          We are rolling out a full English experience. In the meantime, explore the French product site or get in
          touch — our team answers in French and English.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-[#0b2f73] px-8 py-3.5 font-semibold text-white hover:bg-[#144798] transition-colors"
          >
            French website
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-xl border border-[#0b2f73]/30 px-8 py-3.5 font-semibold text-[#0b2f73] hover:bg-slate-50 transition-colors"
          >
            Contact us
          </Link>
        </div>
      </main>
      <InstitutionalFooter />
    </div>
  );
}
