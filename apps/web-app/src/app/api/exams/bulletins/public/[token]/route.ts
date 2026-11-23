/**
 * ============================================================================
 * PROXY API — BULLETIN PUBLIC (partage WhatsApp)
 * ============================================================================
 *
 * GET /api/exams/bulletins/public/:token
 *
 * Route BFF PUBLIQUE (aucune authentification — le token hex 48 caractères
 * est le secret) qui streame le PDF d'un bulletin partagé via WhatsApp vers
 * le backend NestJS GET /institutional-exams/bulletins/public/:token
 * (même pattern que /api/finance/transactions/[id]/receipt.pdf du module
 * finance — encaissement). La page publique /bulletin/[token] télécharge le
 * PDF via cette route : le parent clique le lien reçu sur WhatsApp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token || !/^[0-9a-f]{16,64}$/i.test(token)) {
      return NextResponse.json(
        { message: 'Lien de bulletin invalide.' },
        { status: 400 },
      );
    }

    // ⭐ 60s : la génération du PDF côté Nest passe par Puppeteer (pool
    //    Chrome) — un cold start backend peut dépasser 15s (même rationnel
    //    que /api/finance/transactions/[id]/receipt.pdf).
    const r = await fetchWithTimeout(
      normalizeApiUrl(
        nestControllerUrl(`institutional-exams/bulletins/public/${token}`),
      ),
      { method: 'GET', headers: { Accept: 'application/pdf' }, cache: 'no-store' },
      60_000,
    );

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let detail = text.substring(0, 300);
      try {
        const j = JSON.parse(text);
        detail = String(j?.message || j?.detail || detail);
      } catch { /* réponse non-JSON */ }
      return NextResponse.json(
        { message: 'Bulletin indisponible', detail },
        { status: r.status },
      );
    }

    const contentType = r.headers.get('content-type') || 'application/pdf';
    const disposition =
      r.headers.get('content-disposition') || 'attachment; filename="bulletin.pdf"';
    const buffer = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    });
  } catch (error) {
    console.error('Error downloading public bulletin:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 },
    );
  }
}
