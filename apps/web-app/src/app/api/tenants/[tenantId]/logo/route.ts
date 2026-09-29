import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/tenants/:tenantId/logo
 * Proxy PUBLIC du logo d'une école (image).
 *
 * Backend : tenants.controller.ts:252 @Get(':tenantId/logo') — @Public(),
 * sert le buffer image (base64 stocké en TenantIdentityProfile) ou redirige
 * (302) vers une URL externe.
 *
 * Pourquoi cette route BFF : les exports PDF pédagogiques (registres d'appel,
 * évaluations mensuelles, weekly records, scheme of work — 7 points d'appel
 * `schoolLogoUrl: /api/tenants/${tenant.id}/logo`) chargeient cette URL sur
 * l'origine du web-app alors qu'aucune route Next n'existait → 404 avalé par
 * preloadSchoolLogo → documents générés SANS le logo de l'école.
 *
 * Les redirections vers des logos externes (http…) sont suivies côté serveur
 * (redirect: 'follow') pour éviter les problèmes CORS lors de la conversion
 * en data-URL côté client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  try {
    const upstream = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/tenants/${encodeURIComponent(tenantId)}/logo`),
      { headers: { Accept: 'image/*' }, cache: 'no-store', redirect: 'follow' },
      15_000,
    );
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }
    const contentType = upstream.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return new NextResponse(null, { status: 502 });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
