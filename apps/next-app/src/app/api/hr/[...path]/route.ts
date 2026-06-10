/**
 * ============================================================================
 * PROXY API — MODULE HR (catch-all)
 * ============================================================================
 *
 * Supports:
 *   - JSON body (standard API calls)
 *   - FormData / multipart (file uploads: photo, documents)
 *   - Binary responses (PDF, images)
 *
 * Toutes les requêtes /api/hr/* sont proxysées vers NestJS :
 *   /api/hr/staff?tenantId=...  →  {API_BASE}/hr/staff?tenantId=...
 *   /api/hr/contracts/123       →  {API_BASE}/hr/contracts/123
 *   etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

/** Force dynamique — les cookies / session doivent être lus côté serveur. */
export const dynamic = 'force-dynamic';

/**
 * Increase body size limit for file uploads (CV, cover letter, recommendation letter).
 * Vercel default is 4.5MB — recruitment documents can exceed this.
 * 10MB allows 3 documents of ~3MB each plus form data.
 */
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`hr${path ? `/${path}` : ''}`);
}

async function parseBackendJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: 'Réponse backend invalide' };
  }
}

/**
 * Check if the response is binary (PDF, image, etc.) that should NOT be parsed as JSON.
 */
function isBinaryContentType(contentType: string): boolean {
  return (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/zip') ||
    contentType.includes('image/') ||
    contentType.includes('application/vnd.openxmlformats')
  );
}

/**
 * Check if the request is a multipart/form-data upload.
 */
function isMultipartRequest(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('multipart/form-data');
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = await getProxyAuthHeaders(request);

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };

    if (method !== 'GET' && method !== 'HEAD') {
      if (isMultipartRequest(request)) {
        // For multipart/form-data, forward raw body bytes with original Content-Type
        // (which includes the boundary string needed for parsing)
        const bodyBuffer = Buffer.from(await request.arrayBuffer());
        options.body = bodyBuffer as any;

        // CRITICAL: Remove the default 'Content-Type: application/json' set by
        // getProxyAuthHeaders() — JavaScript objects are case-sensitive, so setting
        // 'content-type' (lowercase) would NOT overwrite 'Content-Type' (titlecase).
        // Both headers would coexist, causing the backend to pick up application/json
        // instead of multipart/form-data, which breaks Multer file extraction and
        // body field parsing (causing "documentType must be a string" and
        // "Aucun fichier photo fourni" errors).
        delete (options.headers as Record<string, string>)['Content-Type'];
        delete (options.headers as Record<string, string>)['content-type'];

        // Set the correct multipart content-type with boundary
        const contentType = request.headers.get('content-type');
        if (contentType) {
          (options.headers as Record<string, string>)['Content-Type'] = contentType;
        }
        // Remove content-length from forwarded headers to let fetch set it
        delete (options.headers as Record<string, string>)['content-length'];
      } else {
        // Standard JSON body
        const text = await request.text();
        if (text.length > 0) {
          options.body = text;
        }
      }
    }

    const res = await fetch(normalizeApiUrl(url.toString()), options);

    // Binary responses (PDF, images, etc.) must be forwarded as-is, not parsed as JSON
    const contentType = res.headers.get('content-type') || '';
    if (isBinaryContentType(contentType)) {
      const buffer = Buffer.from(await res.arrayBuffer());
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'content-type': contentType,
          'content-disposition': res.headers.get('content-disposition') || '',
          'content-length': String(buffer.length),
        },
      });
    }

    const data = await parseBackendJson(res);
    const response = NextResponse.json(data, { status: res.status });
    // Anti-cache headers pour Cloudflare (défense en profondeur)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('X-Accel-Buffering', 'no');
    return response;
  } catch (e) {
    console.error('HR API proxy error:', e);
    return NextResponse.json(
      { error: 'Service RH indisponible' },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
