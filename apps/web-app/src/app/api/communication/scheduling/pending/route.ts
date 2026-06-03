/**
 * ============================================================================
 * API PROXY - PENDING SCHEDULED MESSAGES
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/communication/scheduling/pending`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || ''
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching pending scheduled messages:', error);
    return NextResponse.json({ error: 'Failed to fetch pending scheduled messages' }, { status: 500 });
  }
}

