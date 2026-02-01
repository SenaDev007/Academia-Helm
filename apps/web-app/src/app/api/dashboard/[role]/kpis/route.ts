/**
 * ============================================================================
 * DASHBOARD KPIS API ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
  try {
    const { role } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');

    const url = new URL(`${API_URL}/api/dashboard/${role}/kpis`);
    if (academicYearId) {
      url.searchParams.append('academicYearId', academicYearId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in dashboard KPIs:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
