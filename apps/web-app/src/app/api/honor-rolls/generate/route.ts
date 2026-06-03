/**
 * ============================================================================
 * API ROUTE - GENERATE HONOR ROLL
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(nestControllerUrl('honor-rolls/generate'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to generate honor roll' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating honor roll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
