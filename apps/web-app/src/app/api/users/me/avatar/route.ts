/**
 * ============================================================================
 * API PROXY — PHOTO DE PROFIL UTILISATEUR CONNECTÉ
 * ============================================================================
 *
 * POST   /api/users/me/avatar   { photoDataUrl }  → upload (data URL base64)
 * DELETE /api/users/me/avatar                     → suppression
 *
 * Le backend (sharp) recadre en 512×512 webp et stocke dans users.avatarUrl.
 * L'identité est tirée du JWT côté backend — impossible de modifier la photo
 * d'un autre compte.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/users/me/avatar`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      30000
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ message: "Échec de l'envoi de la photo de profil." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/users/me/avatar`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { method: 'DELETE', headers },
      15000
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return NextResponse.json({ message: 'Échec de la suppression de la photo.' }, { status: 500 });
  }
}
