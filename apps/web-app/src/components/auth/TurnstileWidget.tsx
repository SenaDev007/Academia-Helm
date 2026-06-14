/**
 * ============================================================================
 * TURNSTILE WIDGET — Cloudflare Turnstile pour vérification d'humanité
 * ============================================================================
 *
 * ⚠️ TURNSTILE ACTUELLEMENT DÉSACTIVÉ — Le widget ne s'affiche pas et
 * passe automatiquement un token 'skip-development' au callback onToken.
 *
 * Pour réactiver Turnstile :
 *   1. Définir NEXT_PUBLIC_TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY
 *   2. Remettre ENABLE_TURNSTILE à 'true' dans .env
 *   3. Réactiver la vérification côté serveur dans lib/auth/turnstile.ts
 *   4. Remplacer ce composant par la version active (voir git history)
 *
 * ============================================================================
 */

'use client';

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  /** Callback appelé quand le token Turnstile est obtenu */
  onToken: (token: string) => void;
  /** Callback appelé en cas d'erreur */
  onError?: (error: string) => void;
  /** Callback appelé quand le token expire */
  onExpire?: () => void;
  /** Mode d'affichage */
  theme?: 'light' | 'dark' | 'auto';
}

export default function TurnstileWidget({
  onToken,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onError: _onError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExpire: _onExpire,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  theme: _theme = 'light',
}: TurnstileWidgetProps) {
  // ── TURNSTILE DÉSACTIVÉ — Passer automatiquement le token skip ──
  const calledRef = useRef(false);
  useEffect(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      onToken('skip-development');
    }
  }, [onToken]);

  // Ne rien rendre — Turnstile désactivé
  return null;
}
