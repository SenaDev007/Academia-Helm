'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import PremiumHeader from '@/components/layout/PremiumHeader';
import {
  HELM_GOLD,
  HELM_NAVY,
  HELM_SECTION_BG,
  HELM_TEXT_MUTED,
} from '@/lib/helm-colors';

const ReviewRequestModal = dynamic(
  () => import('@/components/reviews/ReviewRequestModal'),
  { ssr: false },
);

export default function AvisPageClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ background: HELM_SECTION_BG }}>
      <PremiumHeader />
      <div className="h-20" />

      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm" style={{ color: HELM_TEXT_MUTED }}>
          <Link href="/" className="font-medium hover:underline" style={{ color: HELM_NAVY }}>
            Accueil
          </Link>
          <span className="mx-2 opacity-60" aria-hidden>
            /
          </span>
          <span className="text-slate-500">Laisser un avis</span>
        </nav>

        <header className="mb-10 text-center">
          <span
            className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: `linear-gradient(90deg, ${HELM_GOLD}33, ${HELM_GOLD}55)`,
              color: HELM_NAVY,
            }}
          >
            ✦ Votre retour
          </span>
          <h1
            className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ color: HELM_NAVY }}
          >
            Donnez votre avis sur Academia Helm
          </h1>
          <p className="mt-3 text-lg" style={{ color: HELM_TEXT_MUTED }}>
            Notez l’outil et décrivez votre expérience. Les avis sont modérés
            avant d’apparaître sur le site.
          </p>
        </header>

        <ReviewRequestModal
          embedded
          onClose={() => router.push('/')}
        />

        <p className="mt-10 text-center text-sm" style={{ color: HELM_TEXT_MUTED }}>
          Vous utilisez déjà le portail ? Une invitation peut aussi s’afficher
          dans l’application après environ 30 jours d’utilisation.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link
            href="/login"
            className="font-semibold underline decoration-[#C9A84C] decoration-2 underline-offset-2"
            style={{ color: HELM_NAVY }}
          >
            Accéder au portail
          </Link>
        </p>
      </main>
    </div>
  );
}
