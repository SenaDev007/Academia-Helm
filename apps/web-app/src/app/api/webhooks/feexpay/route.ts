/**
 * FeexPay Webhook Route
 *
 * Reçoit les callbacks FeexPay (payin + payout) et les relaie au backend
 * pour la mise à jour des statuts (SalaryPayment, OnlinePayment, Payment).
 *
 * Sécurité : la vérification de signature (si FeexPay fournit un secret)
 * doit être implémentée côté backend principal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Déléguer la logique métier au backend (re-vérification du statut via API)
    const response = await fetch(`${API_URL}/billing/feexpay/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: rawBody,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors du traitement du webhook FeexPay' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors du traitement du webhook FeexPay' },
        { status: response.status },
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('FeexPay webhook error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
