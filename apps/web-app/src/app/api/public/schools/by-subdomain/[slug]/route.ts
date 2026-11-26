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
 * ⭐ 2026-11-26 — AUDIT COÛT (Railway/Neon jamais endormis) : cache mémoire
 *    court du branding par slug. Cette route est appelée à CHAQUE visite du
 *    site institutionnel d'une école (parents + robots Google/apérçus
 *    sociaux — les robots n'ont pas de cache navigateur) → chaque visite
 *    frappait l'API Railway (qui réveille Neon). 60 s de cache par instance
 *    absorbent les rafles de robots ; le branding change rarement.
 */
const BRANDING_CACHE_TTL_MS = 60 * 1000;
const brandingCache = new Map<string, { expires: number; body: any; ok: boolean }>();

/**
 * Extraction du branding depuis la réponse de /public/schools/with-jobs
 * Les données sont déjà pré-résolues par le backend (objet plat)
 * ⭐ 2026-11-23 — tenantId AJOUTÉ : sans lui, le bandeau recrutement du site
 *    institutionnel (TenantRecruitmentBanner) ne peut pas charger les offres
 *    de l'école (l'API jobs exige le tenantId) — le bandeau restait invisible
 *    quand la stratégie 1 (by-subdomain) échouait (timeout/indisponibilité).
 */
function extractBrandingFromSchoolList(school: any) {
  return {
    tenantId: school.tenantId || school.id || null,
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

    // ⭐ Cache mémoire court (robots) — voir commentaire d'entête.
    const cached = brandingCache.get(slug);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, {
        status: cached.ok ? 200 : 404,
        headers: buildCacheHeaders(cached.body),
      });
    }

    // ── STRATÉGIE 1 : /tenants/by-subdomain/:slug (données les plus complètes) ──
    try {
      const response = await bffFetch(`/tenants/by-subdomain/${encodeURIComponent(slug)}`, {
        timeoutMs: 6000,
      });

      if (response.ok) {
        const data = await response.json();
        const branding = extractBrandingFromTenant(data, slug);
        brandingCache.set(slug, { expires: Date.now() + BRANDING_CACHE_TTL_MS, body: branding, ok: true });
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
          brandingCache.set(slug, { expires: Date.now() + BRANDING_CACHE_TTL_MS, body: branding, ok: true });
          return NextResponse.json(branding, {
            headers: buildCacheHeaders(branding),
          });
        }
      }
    } catch (fallbackError: any) {
      console.warn(`[School By Subdomain] Fallback also failed for slug "${slug}":`, fallbackError?.message || fallbackError);
    }

    // ── Aucune source n'a fonctionné ──
    // ⭐ Mis en cache aussi (60 s) : les robots qui scandent des sous-domaines
    //    inexistants ne doivent pas réveiller l'API à chaque tentative.
    const notFound = { error: 'Tenant introuvable', message: `Aucun établissement trouvé pour le slug "${slug}"` };
    brandingCache.set(slug, { expires: Date.now() + BRANDING_CACHE_TTL_MS, body: notFound, ok: false });
    return NextResponse.json(notFound, { status: 404 });
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
