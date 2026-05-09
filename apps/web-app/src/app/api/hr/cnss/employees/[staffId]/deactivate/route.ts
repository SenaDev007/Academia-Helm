/**
 * ============================================================================
 * API PROXY - DEACTIVATE CNSS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const { staffId } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/api/hr/cnss/employees/${staffId}/deactivate`, {
      method: 'PUT',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deactivating CNSS:', error);
    return NextResponse.json({ error: 'Failed to deactivate CNSS' }, { status: 500 });
  }
}

