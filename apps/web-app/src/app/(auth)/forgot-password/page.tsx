/**
 * Page Forgot Password (route auth — layout cohérent avec login)
 *
 * Server component qui résout les informations de l'école depuis le sous-domaine
 * via la route BFF /api/public/schools/by-subdomain/:slug
 * et les passe au composant client ForgotPasswordPage pour un branding conditionnel.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import { generateSEOMetadata } from '@/lib/seo';
import { BRAND } from '@/lib/brand';
import { Loader } from 'lucide-react';
import { isReservedSubdomain } from '@/lib/tenant/constants';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Mot de passe oublié',
  description: 'Réinitialisez le mot de passe de votre compte Academia Helm.',
  path: '/forgot-password',
});

export interface SchoolBranding {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  slogan: string | null;
  motto: string | null;
}

export default async function Page() {
  let schoolBranding: SchoolBranding | null = null;

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      const subdomain = parts[0];

      // Appeler la route BFF qui proxy vers le backend NestJS
      // La BFF normalise l'URL (ajoute /api) et extrait les données de branding
      try {
        const response = await fetch(
          `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
          { cache: 'no-store' },
        );

        if (response.ok) {
          schoolBranding = await response.json();
        }
      } catch {
        // La BFF n'est pas disponible — le client tentera aussi
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" style={{ color: '#1d4fa5' }} />
      </div>
    }>
      <ForgotPasswordPage schoolBranding={schoolBranding} />
    </Suspense>
  );
}
