/**
 * ============================================================================
 * API PROXY - AI CV PARSING
 * ============================================================================
 * Proxies requests to the NestJS backend for AI-powered CV/resume parsing.
 * This endpoint receives a CV file or data and returns structured extracted
 * information using the IA (Intelligence Artificielle) module.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${API_BASE_URL}/api/hr/ia/parse-cv`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error parsing CV:', error);
    return NextResponse.json({ error: 'Failed to parse CV' }, { status: 500 });
  }
}
