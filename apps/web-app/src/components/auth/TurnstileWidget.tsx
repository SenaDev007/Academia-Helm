/**
 * ============================================================================
 * TURNSTILE WIDGET — Cloudflare Turnstile pour vérification d'humanité
 * ============================================================================
 *
 * Composant réutilisable qui intègre Cloudflare Turnstile.
 * Utilisé sur les pages sensibles (login, forgot-password) pour
 * protéger contre le credential stuffing et le spam.
 *
 * Le token généré est validé côté serveur (BFF) avant de transmettre
 * la requête au backend NestJS.
 *
 * Variable d'environnement requise :
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY — Clé publique Cloudflare Turnstile
 *   TURNSTILE_SECRET_KEY           — Clé secrète (serveur uniquement)
 *
 * ============================================================================
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { Shield, Loader, CheckCircle2, AlertCircle } from 'lucide-react';

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

const NAVY = '#0b2f73';

export default function TurnstileWidget({
  onToken,
  onError,
  onExpire,
  theme = 'light',
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Si pas de clé configurée, on skip silencieusement
  if (!siteKey) {
    // En dev sans clé, on passe directement le token comme "skip"
    if (process.env.NODE_ENV === 'development') {
      // Appeler onToken une seule fois
      const calledRef = useRef(false);
      if (!calledRef.current) {
        calledRef.current = true;
        onToken('skip-development');
      }
      return null;
    }
    return null;
  }

  const handleSuccess = useCallback((token: string) => {
    setStatus('success');
    setErrorMessage(null);
    onToken(token);
  }, [onToken]);

  const handleError = useCallback((code: string) => {
    setStatus('error');
    setErrorMessage('Échec de la vérification. Réessayez.');
    onError?.(code);
  }, [onError]);

  const handleExpire = useCallback(() => {
    setStatus('idle');
    onExpire?.();
  }, [onExpire]);

  // Charger le script Turnstile dynamiquement
  const loadTurnstile = useCallback(() => {
    if ((window as any).turnstile) {
      renderWidget();
      return;
    }

    setStatus('loading');
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => renderWidget();
    script.onerror = () => {
      setStatus('error');
      setErrorMessage('Impossible de charger la vérification.');
    };
    document.head.appendChild(script);
  }, []);

  const renderWidget = useCallback(() => {
    const turnstile = (window as any).turnstile;
    if (!turnstile || !widgetRef.current) return;

    // Nettoyer le widget existant
    try {
      turnstile.remove(widgetRef.current);
    } catch {}

    setStatus('loading');
    turnstile.render(widgetRef.current, {
      sitekey: siteKey!,
      callback: handleSuccess,
      'error-callback': handleError,
      'expired-callback': handleExpire,
      theme,
      size: 'normal',
      'response-field': false,
      appearance: 'always',
    });
  }, [siteKey, handleSuccess, handleError, handleExpire, theme]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Container pour le widget Turnstile */}
      <div
        ref={widgetRef}
        onLoad={loadTurnstile}
        className="cf-turnstile"
      />

      {/* Indicateur de statut (visible quand le widget est en cours) */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: NAVY }}>
        {status === 'loading' && (
          <>
            <Loader className="w-3.5 h-3.5 animate-spin" />
            <span>Vérification en cours...</span>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-600">Vérifié</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-red-500">{errorMessage}</span>
          </>
        )}
      </div>

      {/* Script loader trigger */}
      {status === 'idle' && (
        <button
          type="button"
          onClick={loadTurnstile}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-slate-50"
          style={{ borderColor: `${NAVY}30`, color: NAVY }}
        >
          <Shield className="w-3.5 h-3.5" />
          Vérifier que vous êtes humain
        </button>
      )}
    </div>
  );
}
