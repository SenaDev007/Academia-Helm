import { generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Onboarding — Création de votre établissement',
  description: 'Finalisez la création de votre espace Academia Helm.',
  noIndex: true, // Page technique
});

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
