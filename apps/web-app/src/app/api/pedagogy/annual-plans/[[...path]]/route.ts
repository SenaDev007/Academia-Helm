/**
 * ⭐ BFF route pour /api/pedagogy/annual-plans/*
 *    Proxie vers le backend NestJS /pedagogy/annual-plans/*
 *    Endpoints :
 *      GET  /api/pedagogy/annual-plans?academicYearId=Y&classLevel=CI&trimester=1
 *      GET  /api/pedagogy/annual-plans/classes?academicYearId=Y
 *      PUT  /api/pedagogy/annual-plans/:id  (body: { content })
 *      POST /api/pedagogy/annual-plans/seed (body: { academicYearId, schoolLevelId })
 */
import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const queryString = url.search;
  const pathStr = path ? path.join('/') : '';
  const targetUrl = nestControllerUrl(`pedagogy/annual-plans${pathStr ? '/' + pathStr : ''}${queryString}`);

  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(targetUrl, { headers, cache: 'no-store' });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch annual plans' }, { status: response.status });
  }

  // ⭐ Si la réponse est un PDF (binary), streamer tel quel au lieu de parser en JSON
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const pdfBuffer = await response.arrayBuffer();
    const filename = `planification_${pathStr || 'export'}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(await response.json());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`pedagogy/annual-plans${pathStr ? '/' + pathStr : ''}`),
    { method: 'POST', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`pedagogy/annual-plans${pathStr ? '/' + pathStr : ''}`),
    { method: 'PUT', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
