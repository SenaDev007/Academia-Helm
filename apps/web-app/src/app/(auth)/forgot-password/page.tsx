/**
 * Page Forgot Password (route auth — layout cohérent avec login)
 *
 * Server component qui résout les informations de l'école depuis le sous-domaine
 * et les passe au composant client ForgotPasswordPage pour un branding conditionnel.
 *
 * STRATÉGIE DE RÉSOLUTION CÔTÉ SERVEUR :
 *   1. En local : BFF via 127.0.0.1 (self-request local = OK)
 *   2. En production : Appel direct au backend NestJS (évite le self-request Vercel
 *      qui provoque des cold starts et des timeouts ERR_TIMED_OUT)
 *   3. Fallback client : Si le serveur échoue, useSchoolBranding tente via la BFF
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import { generateSEOMetadata } from '@/lib/seo';
import { BRAND } from '@/lib/brand';
import { Loader } from 'lucide-react';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { extractBrandingFromTenant, type SchoolBrandingData } from '@/lib/tenant/branding';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Mot de passe oublié',
  description: 'Réinitialisez le mot de passe de votre compte Academia Helm.',
  path: '/forgot-password',
});

export interface SchoolBranding extends SchoolBrandingData {}

export default async function Page() {
  let schoolBranding: SchoolBranding | null = null;

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      const subdomain = parts[0];

      try {
        const appBaseUrl = getAppBaseUrl();
        const isLocal = appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1');

        if (isLocal) {
          // En local : BFF via 127.0.0.1 (self-request local = rapide)
          const response = await fetch(
            `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
            { cache: 'no-store' },
          );
          if (response.ok) schoolBranding = await response.json();
        } else {
          // En production : Appel direct au backend NestJS
          // (évite le self-request Vercel qui provoque des cold starts)
          const apiBaseUrl = getApiBaseUrl();
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
            schoolBranding = extractBrandingFromTenant(data, subdomain);
          }
        }
      } catch {
        // API indisponible — le client tentera aussi via useSchoolBranding
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
