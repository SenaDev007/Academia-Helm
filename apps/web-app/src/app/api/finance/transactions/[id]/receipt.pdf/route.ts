import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/transactions/:id/receipt.pdf
 * Télécharge le PDF du reçu (proxy vers backend NestJS).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(
      normalizeApiUrl(`${API_URL}/finance/transactions/${id}/receipt.pdf`),
      { headers },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return NextResponse.json(
        { message: 'Reçu introuvable', detail: text.substring(0, 200) },
        { status: r.status },
      );
    }
    // Stream le PDF
    const contentType = r.headers.get('content-type') || 'application/pdf';
    const disposition = r.headers.get('content-disposition') || 'inline; filename="recu.pdf"';
    const buffer = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    });
  } catch (error) {
    console.error('Error downloading receipt:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
