/**
 * ============================================================================
 * API PROXY — CONFIRMATION DU CHANGEMENT D'ADRESSE EMAIL (utilisateur connecté)
 * ============================================================================
 *
 * POST /api/auth/confirm-email-change { code, newEmail }
 *   → proxy vers POST {API}/auth/confirm-email-change (JWT requis)
 *
 * Étape 2 du flux « Changer mon adresse email » (Mon profil → Sécurité) :
 * vérifie le code OTP reçu sur la NOUVELLE adresse, met à jour users.email,
 * invalide TOUTES les sessions (reconnexion obligatoire avec la nouvelle
 * adresse) et notifie l'ancienne adresse (alerte de sécurité).
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
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const newEmail = typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: 'Veuillez saisir les 6 chiffres du code de vérification.' },
        { status: 400 }
      );
    }
    if (!newEmail) {
      return NextResponse.json(
        { success: false, message: 'Nouvelle adresse email manquante — veuillez recommencer le processus.' },
        { status: 400 }
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/auth/confirm-email-change`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, newEmail }),
      },
      20000
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error confirming email change:', error);
    return NextResponse.json(
      { success: false, message: 'Impossible de confirmer le changement pour le moment.' },
      { status: 500 }
    );
  }
}
