/**
 * ============================================================================
 * API ROUTE - CLASS SUBJECTS (Affectations) — CATCH-ALL
 * ============================================================================
 *
 * Handles:
 *   GET  /api/pedagogy/class-subjects?classId=X  → get subjects for a class
 *        (converts classId query param to path segment: /class-subjects/:classId)
 *   POST /api/pedagogy/class-subjects             → create single class-subject
 *   POST /api/pedagogy/class-subjects/bulk        → bulk assign subjects to classes
 *   DELETE /api/pedagogy/class-subjects/:id       → delete a class-subject
 *
 * Forwards to NestJS:
 *   GET   /api/pedagogy/class-subjects/:classId
 *   POST  /api/pedagogy/class-subjects
 *   POST  /api/pedagogy/class-subjects/bulk
 *   DELETE /api/pedagogy/class-subjects/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const headers = await getProxyAuthHeaders(request);
  const searchParams = request.nextUrl.searchParams;

  // ─── Special handling for GET with classId query param ──
  // The frontend sends GET /api/pedagogy/class-subjects?classId=X
  // The backend expects GET /api/pedagogy/class-subjects/:classId (path param)
  // We need to convert the classId query param to a path segment.
  let effectivePathSegments = [...pathSegments];

  if (method === 'GET' && effectivePathSegments.length === 0) {
    const classId = searchParams.get('classId');
    if (classId) {
      // Move classId from query param to path segment
      effectivePathSegments = [classId];
      searchParams.delete('classId');
    }
  }

  // Build the backend URL based on effective path segments
  const basePath = effectivePathSegments.length ? `/${effectivePathSegments.join('/')}` : '';
  const url = new URL(`${nestControllerUrl('pedagogy')}/class-subjects${basePath}`);
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
    console.error('Class subjects proxy error:', error);
    return NextResponse.json(
      { error: 'Service pédagogie indisponible' },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
