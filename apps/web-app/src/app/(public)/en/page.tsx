/**
 * Version anglaise (entrée SEO / hreflang). Contenu synthétique ; à enrichir ou rediriger vers un domaine EN dédié via NEXT_PUBLIC_HREFLANG_EN_URL.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import { buildAbsoluteOGImageUrl, detectRequestHostname } from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';

/**
 * generateMetadata — utilise la détection dynamique du hostname
 * pour construire des URLs OG accessibles aux crawlers sociaux.
 */
export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();
  const ogImageAbsolute = buildAbsoluteOGImageUrl(hostname);
  const canonicalUrl = 'https://www.academiahelm.com/en';

  return {
    title: 'Academia Helm — School operations platform',
    description:
      'Unified school management: students, finance, pedagogy, ORION AI insights. Built for demanding institutions in West Africa and beyond.',
    openGraph: {
      title: 'Academia Helm — School operations platform',
      description: 'Unified school management for modern institutions.',
      url: canonicalUrl,
      siteName: 'Academia Helm',
      locale: 'en_US',
      type: 'website',
      images: [{ url: ogImageAbsolute, width: 1200, height: 630, alt: 'Academia Helm' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Academia Helm — School operations platform',
      description: 'Unified school management for modern institutions.',
      images: [ogImageAbsolute],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: buildHreflangLanguages('https://www.academiahelm.com', '/en'),
    },
  };
}

export default function EnglishLandingEntryPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <p className="text-sm font-semibold text-[#0b2f73] uppercase tracking-wide mb-3">English</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0b2f73] mb-6">
          Academia Helm — your institution&apos;s digital cockpit
        </h1>
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          We are rolling out a full English experience. In the meantime, explore the French product site or get in
          touch — our team answers in French and English.
        </p>
        <div className="flex flex-col sm:flex-col gap-4 justify-center">
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
      <Footer2 />
    </div>
  );
}
