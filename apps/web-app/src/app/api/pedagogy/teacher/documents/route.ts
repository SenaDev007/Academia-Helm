/**
 * ============================================================================
 * API PROXY - TEACHER DOCUMENTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestDoublePrefixedControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${nestDoublePrefixedControllerUrl('pedagogy/teacher/documents')}${queryString ? `?${queryString}` : ''}`;

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, { headers, cache: 'no-store' });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching teacher documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${nestDoublePrefixedControllerUrl('pedagogy/teacher/documents')}${queryString ? `?${queryString}` : ''}`;

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

