/**
 * API Route - QHSE Audits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');

    const params = new URLSearchParams();
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (schoolLevelId) params.append('schoolLevelId', schoolLevelId);

    const token = request.headers.get('authorization') || '';

    const response = await fetch(`${API_BASE_URL}/qhs/audits?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching QHSE audits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audits' },
      { status: 500 }
    );
  }
}

