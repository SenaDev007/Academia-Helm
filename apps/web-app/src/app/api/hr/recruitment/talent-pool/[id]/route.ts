/**
 * ============================================================================
 * API PROXY - RECRUITMENT TALENT POOL ENTRY BY ID
 * ============================================================================
 * Proxies requests to the NestJS backend for managing a specific talent pool
 * entry. Supports POST (add/update) and DELETE (remove) operations.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const url = `${API_BASE_URL}/hr/recruitment/talent-pool/${id}`;

    const response = await fetch(url, {
      method: 'POST',
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
    console.error('Error updating talent pool entry:', error);
    return NextResponse.json({ error: 'Failed to update talent pool entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const url = `${API_BASE_URL}/hr/recruitment/talent-pool/${id}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting talent pool entry:', error);
    return NextResponse.json({ error: 'Failed to delete talent pool entry' }, { status: 500 });
  }
}
