import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/identifiers/${studentId}`),
      { headers }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching matricule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
