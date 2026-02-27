/**
 * Proxy vers l'API NestJS — Classes (scopées par niveau scolaire).
 * Transmet academicYearId et schoolLevelId pour encapsuler les données par niveau.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(`${API_URL}/api/classes`);
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(url.toString(), {
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err || { error: 'Failed to fetch classes' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(`${API_URL}/api/classes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err || { error: 'Failed to create class' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
