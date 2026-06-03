/**
 * ============================================================================
 * API PROXY - RECRUITMENT JOB BY ID
 * ============================================================================
 * Proxies DELETE requests to the NestJS backend for deleting a specific
 * recruitment job posting.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const url = `${API_BASE_URL}/api/hr/recruitment/jobs/${id}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting recruitment job:', error);
    return NextResponse.json({ error: 'Failed to delete recruitment job' }, { status: 500 });
  }
}
