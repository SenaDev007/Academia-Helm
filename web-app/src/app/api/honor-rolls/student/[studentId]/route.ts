/**
 * ============================================================================
 * API ROUTE - HONOR ROLLS BY STUDENT
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(nestControllerUrl(`honor-rolls/student/${studentId}`));
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch honor rolls' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching honor rolls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
