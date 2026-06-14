/**
 * ============================================================================
 * TURNSTILE WIDGET — Cloudflare Turnstile pour vérification d'humanité
 * ============================================================================
 *
 * Composant réutilisable qui intègre Cloudflare Turnstile.
 *
 * FONCTIONNEMENT :
 *   - Utilise le mode Managed de Cloudflare (défaut)
 *   - Cloudflare décide automatiquement s'il affiche la checkbox ou non
 *   - Les utilisateurs légitimes sont souvent validés sans interaction
 *   - Si un défi est nécessaire, la checkbox apparaît automatiquement
 *
 * STABILITÉ :
 *   - Callbacks via refs → évite les re-rendus React qui détruisent et
 *     recréent le widget en boucle
 *   - renderWidget stable → le widget n'est détruit/recréé que si siteKey
 *     ou theme change réellement
 *   - Pas de reset automatique → pas de boucle infinie
 *
 * Variable d'environnement requise :
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY — Clé publique Cloudflare Turnstile
 *   TURNSTILE_SECRET_KEY           — Clé secrète (serveur uniquement)
 *
 * ============================================================================
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
  onError,
  onExpire,
  theme = 'light',
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Refs stables pour les callbacks → évitent les re-rendus du widget ──
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  // Mettre à jour les refs sans déclencher de re-rendu
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

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
    onTokenRef.current(token);
  }, []);

  const handleError = useCallback((code: string) => {
    setStatus('error');
    setErrorMessage('Échec de la vérification. Réessayez.');
    onErrorRef.current?.(code);
  }, []);

  const handleExpire = useCallback(() => {
    setStatus('loading');
    onExpireRef.current?.();
  }, []);

  // ── renderWidget stable : ne dépend que de siteKey et theme ──
  const renderWidget = useCallback(() => {
    const turnstile = (window as any).turnstile;
    if (!turnstile || !widgetRef.current) return;

    // Nettoyer le widget existant
    try {
      if (widgetIdRef.current) {
        turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
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
        // Mode Managed (défaut) : Cloudflare décide du défi à afficher
        appearance: 'always',
        // refresh manuel quand le token expire — pas de cycle automatique
        'refresh-expired': 'manual',
        // Réessayer automatiquement en cas d'erreur réseau
        'retry': 'auto',
        'retry-interval': 2000,
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
      'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'
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
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
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
          widgetIdRef.current = undefined;
        }
      } catch {}
    };
  }, [siteKey, renderWidget]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Container pour le widget Turnstile natif */}
      <div ref={widgetRef} />

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
