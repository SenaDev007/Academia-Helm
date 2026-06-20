/**
 * ============================================================================
 * SCHOOL BY SUBDOMAIN API PROXY — BRANDING DE L'ÉCOLE
 * ============================================================================
 *
 * Route BFF qui résout le branding d'une école depuis son slug/sous-domaine.
 *
 * STRATÉGIE DE RÉSOLUTION (avec fallback) :
 *   1. PRIMAIRE : GET /api/tenants/by-subdomain/:slug
 *      → Retourne les données brutes du tenant, extraction du branding côté BFF
 *   2. FALLBACK : GET /api/public/schools/with-jobs
 *      → Recherche l'école par slug dans la liste publique (même source que /jobs)
 *
 * Utilisée par les pages school-portal, login et forgot-password
 * pour résoudre le branding (logo, nom, slogan, couleurs) de l'école.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { extractBrandingFromTenant } from '@/lib/tenant/branding';

/** Force dynamic — ne pas pré-render au build (backend peut être lent). */
export const dynamic = 'force-dynamic';

/**
 * Extraction du branding depuis la réponse de /public/schools/with-jobs
 * Les données sont déjà pré-résolues par le backend (objet plat)
 */
function extractBrandingFromSchoolList(school: any) {
  return {
    name: school.schoolName || school.name || null,
    slug: school.slug || null,
    logoUrl: school.logoUrl || null,
    city: school.city || null,
    phone: school.phonePrimary || null,
    address: school.address || null,
    primaryColor: school.primaryColor || null,
    secondaryColor: school.secondaryColor || null,
    slogan: school.slogan || null,
    motto: school.motto || null,
    schoolAcronym: school.schoolAcronym || null,
    schoolType: school.schoolType || null,
    website: school.website || null,
    email: school.primaryEmail || null,
  };
}

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

    // ── STRATÉGIE 1 : /tenants/by-subdomain/:slug (données les plus complètes) ──
    const tenantApiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/tenants/by-subdomain/${encodeURIComponent(slug)}`
      : `${API_BASE_URL}/api/tenants/by-subdomain/${encodeURIComponent(slug)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(normalizeApiUrl(tenantApiUrl), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        next: { revalidate: 30 },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const branding = extractBrandingFromTenant(data, slug);
        return NextResponse.json(branding);
      }

      // Si 404, on passe au fallback
      console.warn(`[School By Subdomain] Primary endpoint returned ${response.status} for slug "${slug}", trying fallback...`);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.warn(`[School By Subdomain] Primary endpoint failed for slug "${slug}":`, fetchError?.message || fetchError);
    }

    // ── STRATÉGIE 2 : /public/schools/with-jobs (fallback — même source que /jobs) ──
    const schoolsApiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/public/schools/with-jobs`
      : `${API_BASE_URL}/api/public/schools/with-jobs`;

    try {
      const schoolsResponse = await fetch(normalizeApiUrl(schoolsApiUrl), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 60 },
      });

      if (schoolsResponse.ok) {
        const schools = await schoolsResponse.json();
        if (Array.isArray(schools)) {
          const school = schools.find((s: any) => s.slug === slug);
          if (school) {
            const branding = extractBrandingFromSchoolList(school);
            return NextResponse.json(branding);
          }
        }
      }
    } catch (fallbackError: any) {
      console.warn(`[School By Subdomain] Fallback also failed for slug "${slug}":`, fallbackError?.message || fallbackError);
    }

    // ── Aucune source n'a fonctionné ──
    return NextResponse.json(
      { error: 'Tenant introuvable', message: `Aucun établissement trouvé pour le slug "${slug}"` },
      { status: 404 },
    );
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
