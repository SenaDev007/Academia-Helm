/**
 * ============================================================================
 * API PROXY - APPROVE PAYROLL BONUS
 * ============================================================================
 * Proxies PUT requests to the NestJS backend for approving a specific
 * payroll bonus by ID.
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
    const body = await request.json();
    const url = `${API_BASE_URL}/api/hr/payroll/bonuses/${id}/approve`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error approving payroll bonus:', error);
    return NextResponse.json({ error: 'Failed to approve payroll bonus' }, { status: 500 });
  }
}
