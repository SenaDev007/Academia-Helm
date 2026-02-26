/**
 * Proxy API — Fichier image d'un cachet ou de la signature
 * GET /api/settings/stamps/asset?type=circular|rectangular|oval|signature
 * Retourne le PNG en stream (proxy vers le backend).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const type = request.nextUrl?.searchParams?.get('type');
    if (!type || !['circular', 'rectangular', 'oval', 'signature'].includes(type)) {
      return NextResponse.json(
        { error: 'Paramètre type requis: circular, rectangular, oval ou signature' },
        { status: 400 }
      );
    }
    const url = new URL(`${API_BASE_URL}/settings/stamps/asset`);
    url.searchParams.set('type', type);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    const educationLevelId = request.nextUrl?.searchParams?.get('education_level_id');
    const signatureId = request.nextUrl?.searchParams?.get('signature_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    if (educationLevelId) url.searchParams.set('education_level_id', educationLevelId);
    if (signatureId) url.searchParams.set('signature_id', signatureId);

    const response = await fetch(url.toString(), {
      headers: { ...headers, 'Content-Type': '' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: err || 'Asset not found' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('Content-Type') || 'image/png';
    const blob = await response.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    console.error('Error fetching stamp/signature asset:', error);
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 });
  }
}
