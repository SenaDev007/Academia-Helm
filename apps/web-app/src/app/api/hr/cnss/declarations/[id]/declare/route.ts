/**
 * ============================================================================
 * API PROXY - MARK CNSS DECLARATION AS DECLARED
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
    const response = await fetch(`${API_BASE_URL}/api/hr/cnss/declarations/${id}/declare`, {
      method: 'PUT',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error marking declaration as declared:', error);
    return NextResponse.json({ error: 'Failed to mark declaration as declared' }, { status: 500 });
  }
}

