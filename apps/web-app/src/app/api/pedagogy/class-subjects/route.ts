/**
 * ============================================================================
 * API ROUTE - CLASS SUBJECTS (Affectations)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestDoublePrefixedControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId');
    
    if (!classId) {
      return NextResponse.json(
        { error: 'classId is required' },
        { status: 400 }
      );
    }

    const url = new URL(
      `${nestDoublePrefixedControllerUrl('pedagogy')}/class-subjects/${classId}`,
    );
    searchParams.forEach((value, key) => {
      if (key !== 'classId') {
        url.searchParams.append(key, value);
      }
    });

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch class subjects' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      `${nestDoublePrefixedControllerUrl('pedagogy')}/class-subjects`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to create class subject' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating class subject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

