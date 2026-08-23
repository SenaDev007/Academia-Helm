/**
 * ⭐ BFF route pour /api/chat/*
 *    Proxie vers le backend NestJS /chat/*
 *
 * Endpoints :
 *   GET    /api/chat/conversations
 *   POST   /api/chat/conversations/direct
 *   POST   /api/chat/conversations/group
 *   GET    /api/chat/conversations/:id
 *   GET    /api/chat/conversations/:id/messages
 *   POST   /api/chat/conversations/:id/messages/text
 *   POST   /api/chat/conversations/:id/messages/attachment   (multipart/form-data)
 *   POST   /api/chat/conversations/:id/mark-read
 *   GET    /api/chat/unread-count
 *   GET    /api/chat/search-users
 *   POST   /api/chat/invitations
 *   GET    /api/chat/invitations/pending
 *   POST   /api/chat/invitations/:id/accept
 *   POST   /api/chat/invitations/:id/decline
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
    // ⭐ Pass through the backend's actual error message so the frontend can
    //    display useful diagnostics instead of a generic "Failed to fetch".
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

  // ⭐ Detect multipart/form-data by Content-Type header
  //    Some browsers/proxies may strip the boundary from the Content-Type, so we
  //    also check by sniffing the body's first bytes (multipart starts with "------").
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data')
    || contentType.includes('application/x-www-form-urlencoded')
    // ⭐ Body sniffing fallback: clone the request to read body without consuming it
    || (await isRequestBodyMultipart(request));

  if (isMultipart) {
    // ⭐ For multipart: pass FormData through to NestJS unchanged.
    //    The BFF must NOT call request.json() — that throws "Unexpected token '-'"
    //    on the multipart boundary.
    const headers = await getProxyAuthHeaders(request);
    // Remove Content-Type header so fetch() re-generates the boundary
    const { 'content-type': _ct, ...restHeaders } = headers;
    const formData = await request.formData();
    const response = await fetch(
      nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
      {
        method: 'POST',
        headers: restHeaders as any,
        body: formData as any,
      }
    );

    // ⭐ Always return JSON — never the raw multipart body
    return returnJsonResponse(response);
  }

  // Standard JSON body
  let body: any;
  try {
    body = await request.json();
  } catch (e: any) {
    // The body isn't JSON — likely the multipart detection failed and we ended up here
    // Return a clear error instead of letting Next.js return the raw body
    return NextResponse.json(
      {
        error: 'Invalid request body — expected JSON',
        details: e.message,
        hint: 'If you tried to upload a file, the multipart detection may have failed. Check the Content-Type header.',
      },
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

/**
 * Check if the request body starts with "------" (multipart boundary signature).
 * Uses request.clone() to avoid consuming the original body.
 */
async function isRequestBodyMultipart(request: NextRequest): Promise<boolean> {
  try {
    const cloned = request.clone();
    const reader = cloned.body?.getReader();
    if (!reader) return false;
    const { value } = await reader.read();
    reader.releaseLock();
    if (!value) return false;
    // Decode first 50 bytes as text
    const firstChars = new TextDecoder().decode(value.slice(0, 50));
    return firstChars.startsWith('------') || firstChars.includes('Content-Disposition');
  } catch {
    return false;
  }
}

/**
 * Robust response handler — always returns JSON to the frontend.
 * If the backend response isn't JSON (e.g., HTML error page), wraps it in a JSON error.
 */
async function returnJsonResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) {
    // Read body as text first, then try JSON
    const text = await response.text().catch(() => '');
    let errBody: any = null;
    try {
      errBody = JSON.parse(text);
    } catch {
      // Body isn't JSON — return the text as part of the error message
      errBody = { error: 'Backend returned non-JSON response', body: text.substring(0, 500) };
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch chat data',
        backendError: errBody,
        backendStatus: response.status,
      },
      { status: response.status }
    );
  }
  // Success — return backend's JSON
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch {
    // Backend returned 200 but body isn't JSON — return text wrapped
    return NextResponse.json({ data: text.substring(0, 500) });
  }
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
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
    { method: 'PUT', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
