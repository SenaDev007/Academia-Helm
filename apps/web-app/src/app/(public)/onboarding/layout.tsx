import { generateSEOMetadata } from '@/lib/seo';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';

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
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {children}
      </main>
      <Footer2 />
    </>
  );
}
