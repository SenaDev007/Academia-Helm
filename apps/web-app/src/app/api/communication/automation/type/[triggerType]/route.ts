/**
 * ============================================================================
 * API PROXY - ACTIVE TRIGGERS BY TYPE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ triggerType: string }> }
) {
  const { triggerType } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/communication/automation/type/${triggerType}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || ''
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching triggers by type:', error);
    return NextResponse.json({ error: 'Failed to fetch triggers by type' }, { status: 500 });
  }
}

