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
 * ⚠️ Pattern standardisé : utilise bffFetchJson() + buildCacheHeaders()
 * Voir docs/CACHE_PERFORMANCE_PATTERN.md
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { bffFetch, bffFetchJson, buildCacheHeaders } from '@/lib/api/bff-fetch';
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

    // ── STRATÉGIE 1 : /tenants/by-subdomain/:slug (données les plus complètes) ──
    try {
      const response = await bffFetch(`/tenants/by-subdomain/${encodeURIComponent(slug)}`, {
        timeoutMs: 6000,
      });

      if (response.ok) {
        const data = await response.json();
        const branding = extractBrandingFromTenant(data, slug);
        return NextResponse.json(branding, {
          headers: buildCacheHeaders(branding),
        });
      }

      console.warn(`[School By Subdomain] Primary endpoint returned ${response.status} for slug "${slug}", trying fallback...`);
    } catch (fetchError: any) {
      console.warn(`[School By Subdomain] Primary endpoint failed for slug "${slug}":`, fetchError?.message || fetchError);
    }

    // ── STRATÉGIE 2 : /public/schools/with-jobs (fallback — même source que /jobs) ──
    try {
      const schools = await bffFetchJson<any[]>('/public/schools/with-jobs');
      if (Array.isArray(schools)) {
        const school = schools.find((s: any) => s.slug === slug);
        if (school) {
          const branding = extractBrandingFromSchoolList(school);
          return NextResponse.json(branding, {
            headers: buildCacheHeaders(branding),
          });
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
