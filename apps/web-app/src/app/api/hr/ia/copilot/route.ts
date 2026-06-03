/**
 * ============================================================================
 * API PROXY - IA COPILOT CHAT (SARA)
 * ============================================================================
 * Proxies requests to the NestJS backend for the AI-powered RH Copilot
 * chat assistant (Sara).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${API_BASE_URL}/api/hr/ia/copilot`;

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
    console.error('Error in copilot chat:', error);
    return NextResponse.json({ error: 'Failed to process copilot request' }, { status: 500 });
  }
}
