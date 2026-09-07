import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string; documentId: string }> }
) {
  try {
    const { studentId, documentId } = await params;
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/${studentId}/documents/${documentId}`),
      { method: 'DELETE', headers }
    , 30000);
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting student document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
