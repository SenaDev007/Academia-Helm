/**
 * ============================================================================
 * ONBOARDING CONTRACT — REÇUS D'ENCAISSEMENT (TRANCHES ULTÉRIEURES)
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend POST /onboarding/contract/receipts.
 *
 * ⭐ Encaissement d'une tranche de l'échéancier (Article 4.4 — paiement
 *    échelonné) : émet le reçu REC-AH-AAAA-NNNNN correspondant, le reporte
 *    dans l'échéancier du draft (numéro + date) et l'email au promoteur
 *    avec le PDF en pièce jointe. Idempotent par index de tranche.
 *
 * Body : { draftId, installmentIndex, receivedBy?, receivedByName?, paidAt? }
 *
 * Le contrôleur backend ContractController est @Public (utilisé pendant
 * l'onboarding) — le jeton, s'il existe, est transmis tel quel.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.draftId || body?.installmentIndex === undefined) {
      return NextResponse.json(
        { success: false, message: 'draftId et installmentIndex sont requis.' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = `${apiBaseUrl}/onboarding/contract/receipts`;
    const finalUrl = normalizeApiUrl(targetUrl);

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ success: false, message: 'Invalid response' }))
      : { success: false, message: (await response.text()) || 'Erreur serveur' };

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error emitting installment receipt:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to emit receipt' },
      { status: 500 },
    );
  }
}
