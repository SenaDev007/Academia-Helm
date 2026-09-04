/**
 * Proxy API — Stream the catalogue PDF.
 * GET /api/modules-complementaires/shop/catalogue/pdf?academicYearId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_BASE_URL}/modules-complementaires/shop/catalogue/pdf`);
    request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    const headers = await getProxyAuthHeaders(request);
    delete (headers as any)['Accept'];
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 30000);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return NextResponse.json({ message: errorText.substring(0, 200) }, { status: response.status });
    }
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const disposition = response.headers.get('content-disposition') || 'attachment';
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error proxying shop catalogue PDF:', error);
    return NextResponse.json({ error: 'Failed to fetch catalogue PDF' }, { status: 500 });
  }
}
