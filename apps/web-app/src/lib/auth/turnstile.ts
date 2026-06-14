/**
 * ============================================================================
 * TURNSTILE SERVER VERIFICATION — Validation côté serveur Cloudflare Turnstile
 * ============================================================================
 *
 * Vérifie le token Turnstile envoyé par le client auprès de l'API Cloudflare.
 * Doit être appelé dans les routes BFF avant de transmettre au backend.
 *
 * Si TURNSTILE_SECRET_KEY n'est pas configuré → skip (mode développement).
 * ============================================================================
 */

import { NextRequest } from 'next/server';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Vérifie un token Turnstile côté serveur.
 *
 * @param token - Le token envoyé par le client (depuis le widget Turnstile)
 * @param clientIp - L'IP du client (optionnel, améliore la vérification)
 * @returns true si le token est valide, false sinon
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  clientIp?: string,
): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Si pas de clé secrète configurée → skip (dev mode)
  if (!secretKey) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not configured — skipping verification');
    return { success: true };
  }

  // Token de dev interne — toujours accepter (généré par le widget en mode dev sans clé)
  if (token === 'skip-development') {
    return { success: true };
  }

  // Si pas de token → refuser
  if (!token) {
    return { success: false, error: 'Vérification de sécurité requise.' };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(clientIp ? { remoteip: clientIp } : {}),
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    console.warn('[Turnstile] Verification failed:', data['error-codes']);
    return {
      success: false,
      error: 'Échec de la vérification de sécurité. Veuillez réessayer.',
    };
  } catch (error: any) {
    console.error('[Turnstile] Verification error:', error.message);
    // En cas d'erreur réseau, on laisse passer (fail-open) pour ne pas bloquer les utilisateurs
    return { success: true };
  }
}

/**
 * Extrait l'IP du client depuis la requête Next.js.
 */
export function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || undefined;
}
