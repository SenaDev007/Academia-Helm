import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.academicYearId || !body.schoolLevelId) {
      return NextResponse.json(
        { error: 'academicYearId and schoolLevelId are required' },
        { status: 400 }
      );
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/api/students/id-cards/generate-bulk`), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating bulk ID cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
