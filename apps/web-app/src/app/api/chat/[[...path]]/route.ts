/**
 * ⭐ BFF route pour /api/chat/*
 *    Proxie vers le backend NestJS /chat/*
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
  const targetUrl = nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}${queryString}`);

  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(targetUrl, { headers, cache: 'no-store' });

  if (!response.ok) {
    let errBody: any = null;
    try { errBody = await response.json(); } catch { errBody = await response.text().catch(() => null); }
    return NextResponse.json(
      { error: 'Failed to fetch chat data', backendError: errBody, backendStatus: response.status, targetUrl },
      { status: response.status }
    );
  }
  return NextResponse.json(await response.json());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  const contentType = request.headers.get('content-type') || '';

  // ⭐ SIMPLIFIED: if multipart/form-data, pass the raw body stream through directly
  if (contentType.includes('multipart/form-data')) {
    const authHeaders = await getProxyAuthHeaders(request);
    // ⭐ Build headers: auth headers but REMOVE the default 'Content-Type: application/json'
    //    that getProxyAuthHeaders sets, then add the ORIGINAL multipart Content-Type
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(authHeaders)) {
      // Skip Content-Type — we'll set it from the original request
      if (key.toLowerCase() !== 'content-type') {
        forwardHeaders[key] = value;
      }
    }
    // ⭐ Set the ORIGINAL Content-Type (with boundary) — critical for multer
    forwardHeaders['Content-Type'] = contentType;

    // ⭐ Forward the raw body stream — don't touch it
    const response = await fetch(
      nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
      {
        method: 'POST',
        headers: forwardHeaders,
        body: request.body, // ⭐ Raw ReadableStream — pass through unchanged
        duplex: 'half', // Required for streaming body in Node.js fetch
      } as any
    );

    return returnJsonResponse(response);
  }

  // Standard JSON body
  // ⭐ Task 77 — tolérer les POST SANS body (sync canaux/communautés :
  //    le frontend envoie Content-Type: application/json sans body →
  //    request.json() throwait → 400 « Invalid request body » →
  //    « Synchronisation échouée » dans Helm Connect). Body vide → {}.
  let body: any = {};
  try {
    const raw = await request.text();
    if (raw && raw.trim()) body = JSON.parse(raw);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Invalid request body — expected JSON', details: e.message },
      { status: 400 }
    );
  }

  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
    { method: 'POST', headers, body: JSON.stringify(body) }
  );

  return returnJsonResponse(response);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  // ⭐ Task 77 — PUT sans body toléré (même correctif que POST)
  let body: any = {};
  try {
    const raw = await request.text();
    if (raw && raw.trim()) body = JSON.parse(raw);
  } catch {
    body = {};
  }
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
    { method: 'PUT', headers, body: JSON.stringify(body) }
  );

  return returnJsonResponse(response);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
    { method: 'DELETE', headers }
  );

  return returnJsonResponse(response);
}

/**
 * Always return JSON — even if backend returns non-JSON (HTML error page, etc.)
 */
async function returnJsonResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let errBody: any = null;
    try {
      errBody = JSON.parse(text);
    } catch {
      errBody = { error: 'Backend returned non-JSON response', body: text.substring(0, 500) };
    }
    return NextResponse.json(
      { error: 'Failed to fetch chat data', backendError: errBody, backendStatus: response.status },
      { status: response.status }
    );
  }
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ data: text.substring(0, 500) });
  }
}
