/**
 * ============================================================================
 * API PROXY — DEMANDE DE CHANGEMENT D'ADRESSE EMAIL (utilisateur connecté)
 * ============================================================================
 *
 * POST /api/auth/request-email-change { newEmail }
 *   → proxy vers POST {API}/auth/request-email-change (JWT requis)
 *
 * Étape 1 du flux « Changer mon adresse email » (Mon profil → Sécurité).
 * Même mécanique OTP que « mot de passe oublié », mais le code est envoyé
 * à la NOUVELLE adresse (seul son propriétaire peut confirmer) et lié à la
 * demande via password_resets.pendingEmail. Étape 2 :
 *   - POST /api/auth/confirm-email-change { code, newEmail }
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const newEmail = typeof body?.newEmail === 'string' ? body.newEmail.trim() : '';

    if (!newEmail) {
      return NextResponse.json(
        { success: false, message: 'Veuillez saisir votre nouvelle adresse email.' },
        { status: 400 }
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/auth/request-email-change`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ newEmail }),
      },
      20000
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error requesting email change:', error);
    return NextResponse.json(
      { success: false, message: 'Impossible de demander le code de vérification pour le moment.' },
      { status: 500 }
    );
  }
}
