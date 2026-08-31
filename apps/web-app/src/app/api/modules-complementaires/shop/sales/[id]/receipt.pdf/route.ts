/**
 * Proxy API — Stream the PDF receipt for a Shop sale (ShopSale).
 * GET /api/modules-complementaires/shop/sales/:id/receipt.pdf
 *
 * ⭐ Pattern identical to /api/finance/transactions/[id]/receipt.pdf/route.ts
 *    but for boutique sales. The PDF is generated on-the-fly by the
 *    backend ShopReceiptService (Puppeteer + HTML inline) and streamed
 *    back as a binary blob. The frontend can open it in a new tab or
 *    download it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(`${API_BASE_URL}/modules-complementaires/shop/sales/${id}/receipt.pdf`);
    // Forward tenant_id if present
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);

    const headers = await getProxyAuthHeaders(request);
    // ⭐ Remove Accept: application/json so the backend serves the PDF binary
    delete (headers as any)['Accept'];

    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { headers, cache: 'no-store' },
      30000,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Error fetching shop receipt PDF:', response.status, errorText);
      return NextResponse.json(
        { message: `Backend returned ${response.status}: ${errorText.substring(0, 200)}` },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    const disposition = response.headers.get('content-disposition') || 'attachment; filename="recu-vente.pdf"';
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
    console.error('Error proxying shop receipt PDF:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop receipt PDF' },
      { status: 500 },
    );
  }
}
