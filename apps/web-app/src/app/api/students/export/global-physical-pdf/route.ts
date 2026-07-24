import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/export/global-physical-pdf`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    delete (headers as any)['Accept'];
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur');
      return NextResponse.json({ message: errorText || 'Erreur' }, { status: response.status });
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const disposition = response.headers.get('content-disposition') || 'attachment';
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Content-Disposition': disposition, 'Content-Length': String(buffer.length), 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Erreur' }, { status: 500 });
  }
}
