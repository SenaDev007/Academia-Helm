import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    const url = `${API_BASE_URL}/api/students/${studentId}/history`;
    const response = await fetch(url, {
      headers: { Authorization: request.headers.get('Authorization') || '' },
    });
    if (!response.ok) return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
