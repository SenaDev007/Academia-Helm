/**
 * ============================================================================
 * PROXY — Public Job Apply (multipart/form-data with file uploads)
 * ============================================================================
 *
 * Dedicated route for the public recruitment apply endpoint.
 * Separated from the catch-all HR proxy to set a larger body size limit
 * (10MB) for file uploads (CV, cover letter, recommendation letter).
 *
 * This route is called from the public careers page (/jobs) by unauthenticated
 * users, so no auth headers are required.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';

/** Force dynamic — cookies/session may be read server-side. */
export const dynamic = 'force-dynamic';

/**
 * 10MB body limit for recruitment file uploads (CV + cover letter + recommendation).
 * Vercel default is 4.5MB which is too small for 3 documents.
 */
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

export async function POST(request: NextRequest) {
  const backendUrl = normalizeApiUrl(nestControllerUrl('hr/recruitment/apply'));

  try {
    // Read the raw body (multipart/form-data with files)
    const bodyBuffer = Buffer.from(await request.arrayBuffer());

    const headers: Record<string, string> = {
      // Forward the original Content-Type (includes boundary for multipart)
      'content-type': request.headers.get('content-type') || 'multipart/form-data',
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: bodyBuffer as any,
      cache: 'no-store',
    });

    // Parse the backend response
    const text = await res.text();
    let data: any = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: 'Réponse backend invalide', raw: text.substring(0, 200) };
      }
    }

    const response = NextResponse.json(data, { status: res.status });
    // Anti-cache headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (e: any) {
    console.error('Recruitment apply proxy error:', e);
    return NextResponse.json(
      {
        message: 'Service de candidature indisponible. Veuillez réessayer dans quelques instants.',
        error: e?.message || 'Proxy error',
      },
      { status: 502 },
    );
  }
}
