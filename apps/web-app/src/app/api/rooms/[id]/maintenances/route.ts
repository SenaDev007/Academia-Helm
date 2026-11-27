/**
 * ============================================================================
 * API ROUTE - ROOM MAINTENANCES (Gestion de salle)
 * GET /api/rooms/:id/maintenances?activeOnly=true — historique de maintenance.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(`${API_URL}/rooms/${id}/maintenances`);
    searchParams.forEach((value, key) => {
      const normalizedKey = key === 'tenant_id' ? 'tenantId' : key;
      url.searchParams.append(normalizedKey, value);
    });

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(url.toString()), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Room maintenances API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch room maintenances: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching room maintenances:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
