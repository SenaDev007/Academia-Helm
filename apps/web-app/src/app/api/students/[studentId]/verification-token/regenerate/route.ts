import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const body = await request.json();
    if (!body.academicYearId) {
      return NextResponse.json({ error: 'academicYearId is required' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/${studentId}/verification-token/regenerate`),
      { method: 'POST', headers, body: JSON.stringify({ academicYearId: body.academicYearId }) }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error regenerating verification token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
