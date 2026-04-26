import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/id-cards/${cardId}/download`),
      { headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="carte-scolaire-${cardId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error downloading ID card PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
