import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * DELETE /api/students/id-cards/by-class/:classId?academicYearId=...
 * Supprime toutes les cartes d'une classe physique spécifique.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { classId: string } },
) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/by-class/${params.classId}`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { method: 'DELETE', headers }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting class ID cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
