/**
 * ============================================================================
 * ONBOARDING CONTRACT DOWNLOAD (BFF) — GET /api/onboarding/contract/:fileName
 * ============================================================================
 *
 * Proxy Next.js vers le backend GET /onboarding/contract/:fileName.
 *
 * ⭐ Corrige le 404 « Voir le contrat signé » : le backend retourne un
 *    contractUrl RELATIF (/api/onboarding/contract/contrat-<subdomain>-<ts>.html)
 *    que le wizard et la page de signature différée utilisent directement dans
 *    des liens <a href>. Sans cette route BFF, le lien pointait vers une route
 *    Next.js inexistante sur le domaine web (academiahelm.com) → 404.
 *
 * Le backend sert le contrat en HTML print-friendly (Content-Type text/html,
 * Content-Disposition inline) — on relaie la réponse telle quelle.
 *
 * Sécurité : l'endpoint backend est @Public (flux onboarding pré-auth) avec
 * throttler global ; le nom de fichier est sanitarisé côté backend
 * (path.basename). Côté BFF, on rejette tout nom contenant des séparateurs
 * de chemin.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  try {
    const { fileName } = await params;

    // Garde : refuser les tentatives de traversée de chemin
    if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
      return NextResponse.json(
        { error: 'Nom de fichier de contrat invalide.' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(
      `${apiBaseUrl}/onboarding/contract/${encodeURIComponent(fileName)}`,
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
        'Accept': 'text/html, application/json',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      let message = `Le backend a répondu ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.message || errBody?.error) {
          message = errBody.message || errBody.error;
        }
      } catch {
        // réponse non-JSON — garder le message par défaut
      }
      return NextResponse.json(
        { error: 'Contrat introuvable', message },
        { status: response.status },
      );
    }

    // Relayer le HTML du contrat (affichage inline dans un nouvel onglet)
    const html = await response.text();
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${fileName}"`,
        // Le contrat contient des données personnelles — pas de cache navigateur
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Impossible de récupérer le contrat',
        message: error.message || 'Erreur inconnue',
      },
      { status: 500 },
    );
  }
}
