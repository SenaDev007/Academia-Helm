/**
 * ============================================================================
 * API ROUTE — TEACHER NOTIFICATIONS (catch-all proxy)
 * ============================================================================
 *
 * Forwards to NestJS PedagogyNotificationController at:
 *   /api/pedagogy/teacher-notifications/individual
 *   /api/pedagogy/teacher-notifications/batch
 *
 * Used by the TeachersAcademicWorkspace:
 *   - Individual: button « Notifier » on teacher profile card
 *   - Batch:      button « Notifier tous » in the toolbar
 *
 * Proxies through Next.js to keep the JWT cookie + tenantId handling
 * consistent with all other pedagogy endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const headers = await getProxyAuthHeaders(request);
  const searchParams = request.nextUrl.searchParams;

  const basePath = pathSegments.length ? `/${pathSegments.join('/')}` : '';
  const url = new URL(`${nestControllerUrl('pedagogy')}/teacher-notifications${basePath}`);
  searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const options: RequestInit = { method, headers, cache: 'no-store' };

  if (method !== 'GET' && method !== 'HEAD') {
    const text = await request.text();
    if (text.length > 0) {
      options.body = text;
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(url.toString(), options);
    const text = await response.text();

    if (!text.trim()) {
      return new NextResponse(null, { status: response.status });
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: response.status });
    } catch {
      return new NextResponse(text, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  } catch (error) {
    console.error('Teacher-notifications proxy error:', error);
    return NextResponse.json(
      { error: 'Service pédagogie indisponible' },
      { status: 502 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}
