/**
 * ============================================================================
 * API ROUTE - RESTORE ROOM (Gestion de salle)
 * PUT /api/rooms/:id/restore — réactive une salle après maintenance
 * (statut ACTIVE + clôture des maintenances actives).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/rooms/${id}/restore`), {
      method: 'PUT',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to restore room';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        if (errorText.trim()) errorMessage = errorText.substring(0, 200);
      }
      console.error('Room restore error:', response.status, errorMessage);
      return NextResponse.json(
        { error: errorMessage, message: errorMessage },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error restoring room:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Internal server error' },
      { status: 500 },
    );
  }
}
