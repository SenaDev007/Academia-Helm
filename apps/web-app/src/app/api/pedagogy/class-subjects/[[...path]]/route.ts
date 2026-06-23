/**
 * ============================================================================
 * API ROUTE - CLASS SUBJECTS (Affectations) — CATCH-ALL
 * ============================================================================
 *
 * Handles:
 *   GET  /api/pedagogy/class-subjects?classId=X         → get subjects for a class
 *   POST /api/pedagogy/class-subjects                    → create single class-subject
 *   POST /api/pedagogy/class-subjects/bulk               → bulk assign subjects to classes
 *   DELETE /api/pedagogy/class-subjects/:id              → delete a class-subject
 *
 * Forwards to NestJS:
 *   /api/pedagogy/class-subjects/:classId
 *   /api/pedagogy/class-subjects/bulk
 *   /api/pedagogy/class-subjects (POST)
 *   /api/pedagogy/class-subjects/:id (DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const headers = await getProxyAuthHeaders(request);
  const searchParams = request.nextUrl.searchParams;

  // Build the backend URL based on path segments
  const basePath = pathSegments.length ? `/${pathSegments.join('/')}` : '';
  const url = new URL(`${nestControllerUrl('pedagogy')}/class-subjects${basePath}`);
  searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const options: RequestInit = { method, headers, cache: 'no-store' };

  if (method !== 'GET' && method !== 'HEAD') {
    const text = await request.text();
    if (text.length > 0) {
      options.body = text;
      // Ensure Content-Type is set for JSON
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
    console.error('Class subjects proxy error:', error);
    return NextResponse.json(
      { error: 'Service pédagogie indisponible' },
      { status: 502 },
    );
  }
}

// GET /api/pedagogy/class-subjects?classId=X
// GET /api/pedagogy/class-subjects/:id (if path segments provided)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

// POST /api/pedagogy/class-subjects
// POST /api/pedagogy/class-subjects/bulk
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

// PUT /api/pedagogy/class-subjects/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

// DELETE /api/pedagogy/class-subjects/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
