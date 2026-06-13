/**
 * ============================================================================
 * SCHOOL BY SUBDOMAIN API PROXY — BRANDING DE L'ÉCOLE
 * ============================================================================
 *
 * Route BFF qui proxy la requête vers le backend NestJS
 * GET /api/tenants/by-subdomain/:slug
 *
 * Utilisée par les pages school-portal, login et forgot-password
 * pour résoudre le branding (logo, nom, slogan, couleurs) de l'école
 * depuis son sous-domaine.
 *
 * Avantages du proxy BFF :
 *   - Normalisation automatique de l'URL backend (ajout du /api)
 *   - Évite les problèmes CORS en production
 *   - Centralise la logique d'extraction des données scolaires
 *   - Compatible SSR et client-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

/** ISR : revalidate toutes les 30 secondes — les données d'identité changent rarement. */
export const revalidate = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { error: 'Slug invalide', message: 'Le slug du tenant est requis (min. 2 caractères)' },
        { status: 400 },
      );
    }

    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/tenants/by-subdomain/${encodeURIComponent(slug)}`
      : `${API_BASE_URL}/api/tenants/by-subdomain/${encodeURIComponent(slug)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(normalizeApiUrl(apiUrl), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        next: { revalidate: 30 },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json(
            { error: 'Tenant introuvable', message: `Aucun tenant trouvé pour le slug "${slug}"` },
            { status: 404 },
          );
        }
        const errorData = await response.json().catch(() => ({
          message: `Erreur HTTP ${response.status}: ${response.statusText}`,
        }));
        console.error('[School By Subdomain API] Backend error:', errorData);
        return NextResponse.json(errorData, { status: response.status });
      }

      const data = await response.json();

      // Extraire les données de branding (même logique que le frontend utilisait)
      // Résolution : TenantIdentityProfile (active) → SchoolSettings → School (legacy) → Tenant
      const identity = data.identityProfiles?.[0] ?? null;
      const settings = data.schoolSettings ?? null;
      const school = data.schools ?? null;

      const branding = {
        name: identity?.schoolName || settings?.schoolName || school?.name || data.name || slug,
        slug: data.slug || slug,
        logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
        city: identity?.city || settings?.city || school?.city || null,
        phone: identity?.phonePrimary || settings?.phone || school?.primaryPhone || null,
        address: identity?.address || settings?.address || school?.address || null,
        primaryColor: settings?.primaryColor || school?.primaryColor || null,
        secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
        slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
        motto: school?.motto || null,
        schoolAcronym: identity?.schoolAcronym || school?.abbreviation || null,
        schoolType: identity?.schoolType || school?.schoolType || null,
        website: identity?.website || settings?.website || school?.website || null,
        email: identity?.email || settings?.email || school?.primaryEmail || null,
      };

      return NextResponse.json(branding);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Timeout', message: 'Délai d\'attente dépassé pour la résolution du tenant' },
          { status: 504 },
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[School By Subdomain API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch school branding',
        message: error.message || 'Erreur lors de la récupération du branding de l\'établissement',
      },
      { status: 500 },
    );
  }
}
