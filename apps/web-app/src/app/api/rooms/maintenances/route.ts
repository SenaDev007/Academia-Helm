/**
 * ============================================================================
 * API ROUTE - CREATE ROOM MAINTENANCE (Gestion de salle)
 * POST /api/rooms/maintenances — déclare une maintenance planifiée
 * (body: { roomId, startDate, endDate?, reason }).
 *
 * ⚠️ Route STATIQUE : doit exister car /api/rooms/[id] n'exporte pas POST —
 * sans elle, un POST vers /api/rooms/maintenances serait un 405.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/rooms/maintenances`), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to create room maintenance';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        if (errorText.trim()) errorMessage = errorText.substring(0, 200);
      }
      console.error('Room maintenance create error:', response.status, errorMessage);
      return NextResponse.json(
        { error: errorMessage, message: errorMessage },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating room maintenance:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Internal server error' },
      { status: 500 },
    );
  }
}
