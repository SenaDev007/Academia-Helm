/**
 * School Portal Selection Page
 *
 * Affichée lorsqu'un utilisateur accède directement à un sous-domaine d'école.
 * Présente les 4 portails disponibles dans le contexte de cette école.
 */

import { headers } from 'next/headers';
import SchoolPortalSelector from '@/components/portal/SchoolPortalSelector';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Connexion — ${BRAND.name}`,
  description: `Choisissez votre portail pour vous connecter à votre établissement sur ${BRAND.name}`,
};

export default async function SchoolPortalPage() {
  // Tenter de résoudre les informations de l'école côté serveur
  let schoolInfo = null;
  let subdomain = null;

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      subdomain = parts[0];

      // Tenter de résoudre le tenant depuis l'API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
          schoolInfo = {
            name: data.schoolName || data.name || subdomain,
            slug: data.slug || subdomain,
            logoUrl: data.schoolSettings?.logoUrl || data.schools?.logo || null,
            city: data.schoolSettings?.city || null,
            phone: data.schoolSettings?.phone || data.schools?.primaryPhone || null,
            address: data.schoolSettings?.address || data.schools?.address || null,
          };
        }
      } catch {
        clearTimeout(timeoutId);
        // L'API n'est pas disponible — le composant client tentera aussi
      }
    }
  } catch {
    // headers() peut échouter dans certains contextes
  }

  return <SchoolPortalSelector schoolInfo={schoolInfo} subdomain={subdomain} />;
}
