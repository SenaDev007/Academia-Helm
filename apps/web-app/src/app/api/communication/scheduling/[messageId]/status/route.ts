/**
 * ============================================================================
 * API PROXY - UPDATE SCHEDULED MESSAGE STATUS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/communication/scheduling/${messageId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating scheduled message status:', error);
    return NextResponse.json({ error: 'Failed to update scheduled message status' }, { status: 500 });
  }
}

