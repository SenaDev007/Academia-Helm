/**
 * ============================================================================
 * API PROXY - TEMPLATES BY TYPE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/communication/templates/type/${type}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || ''
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching templates by type:', error);
    return NextResponse.json({ error: 'Failed to fetch templates by type' }, { status: 500 });
  }
}

