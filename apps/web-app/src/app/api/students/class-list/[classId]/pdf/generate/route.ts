/** POST /api/students/class-list/:classId/pdf/generate — génère + stocke le PDF */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await params;
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    headers['Content-Type'] = 'application/json';
    const res = await fetch(
      normalizeApiUrl(`${API_URL}/students/class-list/${encodeURIComponent(classId)}/pdf/generate`),
      { method: 'POST', headers, body: JSON.stringify(body) },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error generating class list PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
