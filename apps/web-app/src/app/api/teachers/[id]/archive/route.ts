import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/api/teachers/${params.id}/archive`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to archive teacher' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error archiving teacher:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
