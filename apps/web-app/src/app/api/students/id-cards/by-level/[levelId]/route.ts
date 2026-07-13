import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * DELETE /api/students/id-cards/by-level/:levelId?academicYearId=...
 * Supprime toutes les cartes d'un niveau scolaire (Maternelle, Primaire, Secondaire).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { levelId: string } },
) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/by-level/${params.levelId}`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(url.toString()), { method: 'DELETE', headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting level ID cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
