/**
 * ============================================================================
 * API PROXY - CANCEL SCHEDULED MESSAGE
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
    const response = await fetch(`${API_BASE_URL}/api/communication/scheduling/${messageId}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    return NextResponse.json({ error: 'Failed to cancel scheduled message' }, { status: 500 });
  }
}

