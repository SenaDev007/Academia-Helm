/**
 * ============================================================================
 * API ROUTE - SET ROOM MAINTENANCE (Gestion de salle)
 * POST /api/rooms/:id/maintenance — met immédiatement une salle en
 * maintenance (body: { reason }) + annule les allocations futures.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/rooms/${id}/maintenance`), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to set room maintenance';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        if (errorText.trim()) errorMessage = errorText.substring(0, 200);
      }
      console.error('Room maintenance error:', response.status, errorMessage);
      return NextResponse.json(
        { error: errorMessage, message: errorMessage },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error setting room maintenance:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Internal server error' },
      { status: 500 },
    );
  }
}
