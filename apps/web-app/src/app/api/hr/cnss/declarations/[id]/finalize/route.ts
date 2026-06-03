/**
 * ============================================================================
 * API PROXY - CNSS DECLARATION FINALIZE
 * ============================================================================
 * Proxies requests to the NestJS backend for finalizing CNSS declarations.
 * Translates the frontend status to the correct backend endpoint:
 *   - If body.status is 'GENERATED', proxies PUT to /hr/cnss/declarations/{id}/declare
 *   - If body.status is 'PAID', proxies PUT to /hr/cnss/declarations/{id}/mark-paid
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const status = body?.status;

    let endpoint: string;
    if (status === 'GENERATED') {
      endpoint = `/hr/cnss/declarations/${id}/declare`;
    } else if (status === 'PAID') {
      endpoint = `/hr/cnss/declarations/${id}/mark-paid`;
    } else {
      return NextResponse.json(
        { error: `Invalid status: "${status}". Must be "GENERATED" or "PAID".` },
        { status: 400 }
      );
    }

    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error finalizing CNSS declaration:', error);
    return NextResponse.json({ error: 'Failed to finalize CNSS declaration' }, { status: 500 });
  }
}
