/**
 * Page Forgot Password (route auth — layout cohérent avec login)
 *
 * Server component qui résout les informations de l'école depuis le sous-domaine
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
          const identity = data.identityProfiles?.[0];
          const settings = data.schoolSettings;
          const school = data.schools;

          schoolBranding = {
            name: identity?.schoolName || settings?.schoolName || school?.name || data.name || subdomain,
            slug: data.slug || subdomain,
            logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
            city: identity?.city || settings?.city || school?.city || null,
            slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
            motto: school?.motto || null,
          };
        }
      } catch {
        clearTimeout(timeoutId);
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
