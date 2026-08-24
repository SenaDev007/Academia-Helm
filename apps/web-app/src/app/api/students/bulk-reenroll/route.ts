import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/students/bulk-reenroll
 * Proxy vers le backend NestJS /students/bulk-reenroll
 *
 * Body: {
 *   studentIds: string[],
 *   academicYearId: string,
 *   schoolLevelId: string,
 *   classId?: string,
 *   enrollmentType: 'NEW' | 'REPEAT' | 'PROMOTION' | 'TRANSFER'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students/bulk-reenroll`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    console.error('Error bulk-reenroll:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
