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
    // ⭐ FIX 2026-09-16 — timeout porté de 15s à 60s : la génération d'un reçu
    //    passe par Puppeteer (acquisition pool + rendu HTML→PDF + écriture
    //    disque). Sur un backend en cold start ou un pool Chrome fraîchement
    //    relancé, 15s provoquaient « impossible de télécharger le fichier ».
    //    C'est une action explicite de l'utilisateur : on peut se permettre
    //    d'attendre plus longtemps qu'un appel API classique.
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/transactions/${id}/receipt.pdf`),
      { headers },
      60_000,
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      // ⭐ FIX 2026-09-16 — remonter le VRAI message backend (ex-clôture de
      //    caisse) au lieu du « Reçu introuvable » générique qui induisait en
      //    erreur : le reçu existe, c'est sa génération/consultation qui échouait.
      let detail = text.substring(0, 300);
      try {
        const j = JSON.parse(text);
        detail = String(j?.message || j?.detail || detail);
      } catch { /* réponse non-JSON */ }
      return NextResponse.json(
        { message: 'Reçu indisponible', detail },
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
