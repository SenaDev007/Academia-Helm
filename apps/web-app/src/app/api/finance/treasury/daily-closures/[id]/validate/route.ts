/**
 * ============================================================================
 * API PROXY - VALIDATE DAILY CLOSURE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${API_BASE_URL}/api/finance/daily-closures/${id}/validate`, {
      method: 'PATCH',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error validating daily closure:', error);
    return NextResponse.json({ error: 'Failed to validate daily closure' }, { status: 500 });
  }
}

