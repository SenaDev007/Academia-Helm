/**
 * Fedapay Webhook Route
 *
 * Reçoit les événements Fedapay et les relaie au backend
 * pour la gestion des états d'abonnement.
 *
 * Sécurité : la vérification de signature doit être implémentée
 * côté backend principal. Ici, on fait une délégation contrôlée.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-fedapay-signature') || '';
    const rawBody = await request.text();

    // Déléguer la vérification de la signature et la logique métier au backend
    const response = await fetch(`${API_URL}/billing/fedapay/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fedapay-signature': signature,
      },
      body: rawBody,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors du traitement du webhook' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors du traitement du webhook' },
        { status: response.status },
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Fedapay webhook error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}


