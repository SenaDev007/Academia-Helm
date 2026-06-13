/**
 * Page Login — Academia Helm
 *
 * Server component qui résout les informations de l'école depuis le sous-domaine
 * via la route BFF /api/public/schools/by-subdomain/:slug
 * et les passe au composant client LoginPage pour un branding conditionnel.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import LoginPage from '@/components/auth/LoginPage';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';

export const metadata: Metadata = {
  title: `Connexion - ${BRAND.name}`,
  description: `${BRAND.description}. ${BRAND.slogan}`,
};

export interface SchoolBranding {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
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

  return <LoginPage schoolBranding={schoolBranding} />;
}
