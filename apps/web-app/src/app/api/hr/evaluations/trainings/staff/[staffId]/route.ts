/**
 * ============================================================================
 * API PROXY - STAFF TRAININGS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const { staffId } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/api/hr/evaluations/trainings/staff/${staffId}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching staff trainings:', error);
    return NextResponse.json({ error: 'Failed to fetch staff trainings' }, { status: 500 });
  }
}

