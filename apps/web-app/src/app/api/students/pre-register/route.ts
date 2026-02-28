/**
 * ============================================================================
 * API ROUTE - STUDENTS PRE-REGISTER
 * ============================================================================
 * Proxy vers l'API NestJS : POST /api/students/pre-register
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(`${API_URL}/api/students/pre-register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data || { error: 'Failed to pre-register student' }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error pre-registering student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

