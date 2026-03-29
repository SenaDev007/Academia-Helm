import type { Metadata } from 'next';

/** Flux post-paiement : ne pas indexer. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
