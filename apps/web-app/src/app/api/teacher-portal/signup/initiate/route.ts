/**
 * ============================================================================
 * HELM ENSEIGNANT — BFF SIGNUP/INITIATE (inscription « paiement d'abord »)
 * ============================================================================
 *
 * Proxy vers NestJS POST /api/teacher-portal/signup/initiate :
 *   - vérification Cloudflare Turnstile (si configurée) ;
 *   - le backend crée/mets à jour le DRAFT (identité + hash du mot de
 *     passe + niveaux) SANS créer le compte ;
 *   - le backend initialise la transaction FedaPay de 2 000 FCFA et
 *     renvoie { paymentUrl } ;
 *   - le front redirige vers la page de paiement FedaPay ; au retour
 *     (/prof/register/success), la vérification serveur crée le compte
 *     et envoie l'email d'identifiants.
 *
 * ⚠️ AUCUNE session n'est posée ici : le compte n'existe pas encore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { verifyTurnstile, getClientIp } from '@/lib/auth/turnstile';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Vérification Cloudflare Turnstile (si configurée) ──
    const turnstileResult = await verifyTurnstile(body.turnstileToken, getClientIp(request));
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, message: turnstileResult.error || 'Vérification de sécurité échouée.' },
        { status: 403 },
      );
    }

    const { turnstileToken, ...proxyBody } = body;

    const response = await fetch(`${API_BASE_URL}/teacher-portal/signup/initiate`, {
      method: 'POST',
      headers: bffHeaders(),
      body: JSON.stringify(proxyBody),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            data?.message ||
            'L’initialisation du paiement a échoué. Vérifiez vos informations puis réessayez.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Teacher-portal signup/initiate BFF error:', error);
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez dans quelques instants.',
      },
      { status: 500 },
    );
  }
}
