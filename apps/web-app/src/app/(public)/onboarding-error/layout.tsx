import { generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Erreur d\'inscription — Academia Helm',
  description: 'Une erreur est survenue lors de la création de votre établissement.',
  robots: 'noindex, nofollow',
});

export default function OnboardingErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
