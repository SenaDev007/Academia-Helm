/**
 * ============================================================================
 * TURNSTILE WIDGET — Cloudflare Turnstile pour vérification d'humanité
 * ============================================================================
 *
 * Composant réutilisable qui intègre Cloudflare Turnstile.
 * Le widget natif Turnstile s'affiche directement avec sa checkbox intégrée,
 * sans bouton intermédiaire. L'utilisateur coche directement dans le widget.
 *
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Shield } from 'lucide-react';

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
  const widgetIdRef = useRef<string | undefined>(undefined);
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

  const renderWidget = useCallback(() => {
    const turnstile = (window as any).turnstile;
    if (!turnstile || !widgetRef.current) return;

    // Nettoyer le widget existant
    try {
      if (widgetIdRef.current) {
        turnstile.remove(widgetIdRef.current);
      } else if (widgetRef.current) {
        turnstile.remove(widgetRef.current);
      }
    } catch {}

    setStatus('loading');
    try {
      const id = turnstile.render(widgetRef.current, {
        sitekey: siteKey!,
        callback: handleSuccess,
        'error-callback': handleError,
        'expired-callback': handleExpire,
        theme,
        size: 'normal',
        'response-field': false,
        appearance: 'always',
      });
      widgetIdRef.current = id;
    } catch {
      setStatus('error');
      setErrorMessage('Impossible de charger la vérification.');
    }
  }, [siteKey, handleSuccess, handleError, handleExpire, theme]);

  // Charger le script Turnstile automatiquement au montage
  useEffect(() => {
    if (!siteKey) return;

    // Si le script est déjà chargé, render directement
    if ((window as any).turnstile) {
      renderWidget();
      return;
    }

    // Sinon, charger le script puis render
    setStatus('loading');

    // Vérifier si un script est déjà en cours de chargement
    const existingScript = document.querySelector(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    if (existingScript) {
      // Attendre que le script soit chargé
      const checkLoaded = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(checkLoaded);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

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

    return () => {
      // Cleanup : retirer le widget au démontage
      try {
        const turnstile = (window as any).turnstile;
        if (widgetIdRef.current && turnstile) {
          turnstile.remove(widgetIdRef.current);
        }
      } catch {}
    };
  }, [siteKey, renderWidget]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Placeholder pendant le chargement du script */}
      {status === 'idle' && (
        <div
          className="flex items-center gap-2 h-[65px] px-4 rounded-lg border border-dashed"
          style={{ borderColor: `${NAVY}30`, color: NAVY }}
        >
          <Shield className="w-4 h-4" />
          <span className="text-xs">Chargement de la vérification...</span>
        </div>
      )}

      {/* Container pour le widget Turnstile natif */}
      <div
        ref={widgetRef}
        className={status === 'idle' ? 'hidden' : ''}
      />

      {/* Indicateur de statut complémentaire */}
      {status === 'success' && (
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-600">Vérifié</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-500">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
