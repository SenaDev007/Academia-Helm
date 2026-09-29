/**
 * ============================================================================
 * API PROXY — DEMANDE DE CHANGEMENT DE MOT DE PASSE (utilisateur connecté)
 * ============================================================================
 *
 * POST /api/auth/request-password-change
 *   → proxy vers POST {API}/auth/request-password-change (JWT requis)
 *
 * Étape 1 du flux de changement de mot de passe « Mon profil ».
 * Le backend envoie un code OTP à 6 chiffres à l'email de l'utilisateur
 * connecté (tiré du JWT) — EXACTEMENT le même processus que « mot de passe
 * oublié » sur la page login. Les étapes 2 et 3 réutilisent les routes
 * publiques existantes :
 *   - POST /api/auth/verify-reset-otp   { email, code }
 *   - POST /api/auth/reset-password     { email, code, newPassword }
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
    const url = new URL(`${API_BASE_URL}/auth/request-password-change`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { method: 'POST', headers },
      20000
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error requesting password change:', error);
    return NextResponse.json(
      { message: 'Impossible de demander le code de vérification pour le moment.' },
      { status: 500 }
    );
  }
}
