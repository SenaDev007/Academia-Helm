/**
 * Page Login — Academia Helm
 *
 * Server component qui résout les informations de l'école depuis le sous-domaine
 * et les passe au composant client LoginPage pour un branding conditionnel.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import LoginPage from '@/components/auth/LoginPage';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { getApiBaseUrl } from '@/lib/utils/urls';

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

      // Résoudre le tenant depuis l'API backend
      // ⚠️ Utiliser getApiBaseUrl() qui ajoute automatiquement le préfixe /api
      // (NestJS exige /api sur toutes les routes — setGlobalPrefix('api'))
      const apiUrl = getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          // Résolution des données scolaires (identité > settings > école)
          const identity = data.identityProfiles?.[0];
          const settings = data.schoolSettings;
          const school = data.schools;

          schoolBranding = {
            name: identity?.schoolName || settings?.schoolName || school?.name || data.name || subdomain,
            slug: data.slug || subdomain,
            logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
            city: identity?.city || settings?.city || school?.city || null,
            phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
            address: identity?.address || settings?.address || school?.address || null,
            primaryColor: settings?.primaryColor || school?.primaryColor || null,
            secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
            slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
            motto: school?.motto || null,
          };
        }
      } catch {
        clearTimeout(timeoutId);
        // L'API n'est pas disponible — le client tentera aussi
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return <LoginPage schoolBranding={schoolBranding} />;
}
