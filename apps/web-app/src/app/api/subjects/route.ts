/**
 * ============================================================================
 * API ROUTE - SUBJECTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(nestControllerUrl('subjects'));
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
        { error: 'Failed to fetch subjects' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching subjects:', error);
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
    const response = await fetch(nestControllerUrl('subjects'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      // Transmettre le message d'erreur exact du backend (pas juste "Failed to create subject")
      const errorText = await response.text();
      let errorMessage = 'Failed to create subject';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        if (errorText.trim()) errorMessage = errorText.substring(0, 200);
      }
      console.error('[api/subjects POST] Backend error:', response.status, errorMessage);
      return NextResponse.json(
        { error: errorMessage, message: errorMessage, statusCode: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
