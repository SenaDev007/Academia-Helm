import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

/**
 * Proxy BFF pour l'upload public d'une photo de profil accompagnant un avis.
 *
 * Le client envoie `multipart/form-data` avec un champ `photo`. On relaie tel
 * quel vers l'API NestJS (`POST /reviews/upload-photo`) en préservant le
 * Content-Type multipart et le boundary.
 */
export async function POST(request: NextRequest) {
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const path = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/reviews/upload-photo`
    : `${API_BASE_URL}/reviews/upload-photo`;
  const apiUrl = normalizeApiUrl(path);

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { message: 'Content-Type doit être multipart/form-data.' },
        { status: 400 },
      );
    }

    // On relaie le corps de la requête multipart tel quel (sans parser côté BFF)
    // afin de préserver le boundary et les métadonnées binaires du fichier.
    // On n'utilise PAS bffHeaders() qui imposerait `Content-Type: application/json`
    // et écraserait le boundary multipart.
    const body = await request.arrayBuffer();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
        Accept: 'application/json',
        'Content-Type': contentType,
      },
      body,
    });
    const resBody = await response.text();
    return new NextResponse(resBody, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Service indisponible' },
      { status: 502 },
    );
  }
}
