/**
 * School Portal Selection Page
 *
 * Affichée lorsqu'un utilisateur accède directement à un sous-domaine d'école.
 * Présente les 4 portails disponibles dans le contexte de cette école.
 * Résout le branding de l'école (logo, nom, couleurs, slogan) côté serveur
 * via la route BFF /api/public/schools/by-subdomain/:slug.
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

      // Appeler la route BFF qui proxy vers le backend NestJS
      // La BFF normalise l'URL (ajoute /api) et extrait les données de branding
      try {
        const response = await fetch(
          `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
          { cache: 'no-store' },
        );

        if (response.ok) {
          schoolInfo = await response.json();
        }
      } catch {
        // La BFF n'est pas disponible — le composant client tentera aussi
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return <SchoolPortalSelector schoolInfo={schoolInfo} subdomain={subdomain} />;
}
