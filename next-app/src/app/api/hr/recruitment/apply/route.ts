/**
 * ============================================================================
 * PROXY — Public Job Apply (multipart/form-data with file uploads)
 * ============================================================================
 *
 * Dedicated route for the public recruitment apply endpoint.
 * Separated from the catch-all HR proxy to handle large file uploads
 * (CV, cover letter, recommendation letter).
 *
 * This route is called from the public careers page (/jobs) by unauthenticated
 * users, so no auth headers are required.
 *
 * IMPORTANT: In Next.js App Router, the `config.api.bodyParser` pattern
 * from Pages Router does NOT work. The body size limit is controlled by
 * the deployment platform (Vercel). For larger uploads, configure
 * `vercel.json` functions config or use the Edge runtime.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';

/** Force dynamic — cookies/session may be read server-side. */
export const dynamic = 'force-dynamic';

/**
 * Increase max duration for file upload processing (default is 10s on Vercel Hobby).
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const backendUrl = normalizeApiUrl(nestControllerUrl('hr/recruitment/apply'));

  try {
    // Read the raw body (multipart/form-data with files)
    const bodyBuffer = Buffer.from(await request.arrayBuffer());

    console.log(`[apply-proxy] Forwarding ${bodyBuffer.length} bytes to ${backendUrl}`);

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
        data = { error: 'Réponse backend invalide', raw: text.substring(0, 500) };
      }
    }

    // If the backend returned an error, log it for debugging
    if (!res.ok) {
      console.error(`[apply-proxy] Backend error ${res.status}:`, JSON.stringify(data).substring(0, 500));
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
        detail: e?.message || 'Proxy error',
      },
      { status: 502 },
    );
  }
}
