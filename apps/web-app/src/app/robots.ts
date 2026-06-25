/**
 * ============================================================================
 * ROBOTS.TXT — Dynamique par tenant
 * ============================================================================
 *
 * Génère un robots.txt différent selon le sous-domaine :
 *   - Domaine principal (academiahelm.com) → sitemap principal
 *   - Sous-domaine école ({slug}.academiahelm.com) → sitemap du tenant
 *
 * Autorise l'indexation de toutes les pages publiques et bloque
 * les pages privées (/app/*, /api/*, /login, etc.)
 * ============================================================================
 */

import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
  const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

  // Déterminer si on est sur un sous-domaine d'école
  const isSchoolSubdomain = parts.length >= 3 && !['www', 'admin', 'api', 'app', 'portal'].includes(parts[0]);
  const baseUrl = isSchoolSubdomain
    ? `https://${parts.join('.')}`
    : 'https://academiahelm.com';

  if (isSchoolSubdomain) {
    // ─── Sous-domaine d'école ──
    return {
      rules: [
        {
          userAgent: '*',
          allow: ['/'],
          disallow: [
            '/app/',
            '/api/',
            '/login',
            '/admin-login',
            '/forgot-password',
            '/reset-password',
            '/onboarding',
            '/platform/',
            '/school-portal',
            '/portal',
            '/sign/',
            '/verify/',
            '/test/',
            '/upload-documents/',
            '/staff-card/',
            '/jobs/',
            '/offline',
            '/error/',
            '/tenant-not-found',
            '/reactivate',
            '/signup/',
          ],
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
      host: baseUrl,
    };
  }

  // ─── Domaine principal ──
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/api/', '/platform/', '/admin-login'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
