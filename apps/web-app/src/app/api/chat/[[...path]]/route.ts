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
    return NextResponse.json({ error: 'Failed to fetch chat data' }, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  // ⭐ Handle multipart/form-data for file uploads (attachments)
  //    The form-data must be passed through to NestJS as binary, not parsed as JSON.
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
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
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err, { status: response.status });
    }
    return NextResponse.json(await response.json());
  }

  // Standard JSON body
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
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
    nestControllerUrl(`chat${pathStr ? '/' + pathStr : ''}`),
    { method: 'PUT', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
