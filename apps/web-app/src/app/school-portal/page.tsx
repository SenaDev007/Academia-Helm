/**
 * School Portal Selection Page
 *
 * Affichée lorsqu'un utilisateur accède directement à un sous-domaine d'école.
 * Présente les 4 portails disponibles dans le contexte de cette école.
 * Résout le branding de l'école (logo, nom, couleurs, slogan) côté serveur.
 *
 * STRATÉGIE DE RÉSOLUTION CÔTÉ SERVEUR :
 *   1. En local : BFF via 127.0.0.1 (self-request local = OK)
 *   2. En production : Appel direct au backend NestJS (évite le self-request Vercel
 *      qui provoque des cold starts et des timeouts ERR_TIMED_OUT)
 *   3. Fallback client : Si le serveur échoue, le composant client tente via la BFF
 */

import { headers } from 'next/headers';
import SchoolPortalSelector from '@/components/portal/SchoolPortalSelector';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { extractBrandingFromTenant } from '@/lib/tenant/branding';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';
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

      try {
        const appBaseUrl = getAppBaseUrl();
        const isLocal = appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1');

        if (isLocal) {
          // En local : BFF via 127.0.0.1 (self-request local = rapide)
          const response = await fetch(
            `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
            { cache: 'no-store' },
          );
          if (response.ok) schoolInfo = await response.json();
        } else {
          // En production : Appel direct au backend NestJS
          // (évite le self-request Vercel qui provoque des cold starts)
          const apiBaseUrl = getApiBaseUrl(); // ex: https://api.academiahelm.com/api
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const response = await fetch(
            `${apiBaseUrl}/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            schoolInfo = extractBrandingFromTenant(data, subdomain);
          }
        }
      } catch {
        // API indisponible — le composant client tentera aussi via la BFF
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return <SchoolPortalSelector schoolInfo={schoolInfo} subdomain={subdomain} />;
}
