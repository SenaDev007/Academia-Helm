import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string; guardianId: string }> }
) {
  try {
    const { studentId, guardianId } = await params;
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/${studentId}/guardians/${guardianId}`),
      { method: 'PUT', headers, body: JSON.stringify(body) }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating guardian:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string; guardianId: string }> }
) {
  try {
    const { studentId, guardianId } = await params;
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/${studentId}/guardians/${guardianId}`),
      { method: 'DELETE', headers }
    );
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting guardian:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
