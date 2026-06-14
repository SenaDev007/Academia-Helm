/**
 * ============================================================================
 * TURNSTILE WIDGET — Cloudflare Turnstile pour vérification d'humanité
 * ============================================================================
 *
 * Composant réutilisable qui intègre Cloudflare Turnstile.
 *
 * SÉCURITÉ — INTERACTION MANUELLE OBLIGATOIRE :
 *   - appearance: 'always' → le widget est toujours visible
 *   - execution: 'render' → rendu explicite, pas d'exécution automatique
 *   - userInteractedRef → le token n'est accepté QUE si l'utilisateur a
 *     cliqué manuellement sur la checkbox (empêche l'auto-vérification
 *     du mode Managed de Cloudflare)
 *   - Si Turnstile auto-valide sans clic → reset du widget
 *
 * OPTIMISATIONS ANTI-CLIGNOTEMENT :
 *   - refresh-expired: 'manual' → empêche le refresh automatique
 *   - Callbacks via refs → évite les re-rendus React qui détruisent et
 *     recréent le widget en boucle
 *   - renderWidget stable → le widget n'est détruit/recréé que si siteKey
 *     ou theme change réellement
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

  // ── Suivi de l'interaction utilisateur ──
  // Turnstile Managed peut auto-valider sans clic. On suit si l'utilisateur
  // a cliqué sur le widget pour n'accepter que les validations manuelles.
  const userInteractedRef = useRef(false);

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
    // ── PROTECTION : n'accepter que si l'utilisateur a interagi ──
    // Si Turnstile auto-valide (Managed), on ignore le token.
    // L'utilisateur DOIT cliquer sur la checkbox manuellement.
    if (!userInteractedRef.current) {
      // Reset le widget pour forcer l'interaction manuelle
      const turnstile = (window as any).turnstile;
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.reset(widgetIdRef.current);
        } catch {}
      }
      return;
    }
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
    setStatus('idle');
    onExpireRef.current?.();
  }, []);

  // ── renderWidget stable : ne dépend que de siteKey et theme ──
  // Les callbacks sont accédés via refs, donc le widget n'est pas
  // détruit/recréé quand les props callback changent.
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
      // ── Détecter le clic utilisateur sur le widget Turnstile ──
      // Turnstile Managed peut auto-valider ; on exige un clic manuel.
      const handleWidgetClick = () => {
        userInteractedRef.current = true;
      };
      // Stocker la ref pour le cleanup
      (widgetRef.current as any)._clickHandler = handleWidgetClick;
      widgetRef.current.addEventListener('mousedown', handleWidgetClick);
      widgetRef.current.addEventListener('touchstart', handleWidgetClick);

      const id = turnstile.render(widgetRef.current, {
        sitekey: siteKey!,
        callback: handleSuccess,
        'error-callback': handleError,
        'expired-callback': handleExpire,
        theme,
        size: 'normal',
        'response-field': false,
        // ── CLÉ : toujours afficher le widget pour forcer l'interaction ──
        // L'utilisateur DOIT cocher la checkbox manuellement (sécurité)
        appearance: 'always',
        // ── CLÉ : rendu explicite, pas d'exécution automatique ──
        // Empêche Turnstile de se valider tout seul sans interaction
        execution: 'render',
        // ── CLÉ : pas de refresh automatique quand le token expire ──
        // Empêche le cycle apparaît/disparaît/réapparaît
        'refresh-expired': 'manual',
        // Réessayer automatiquement en cas d'erreur réseau (1 tentative, 2s)
        'retry': 'auto',
        'retry-interval': 2000,
      });
      widgetIdRef.current = id;
    } catch {
      setStatus('error');
      setErrorMessage('Impossible de charger la vérification.');
    }
  }, [siteKey, handleSuccess, handleError, handleExpire, theme]);

  // ── Nettoyer les event listeners du widget ──
  useEffect(() => {
    const el = widgetRef.current;
    return () => {
      if (el) {
        const handler = (el as any)._clickHandler;
        if (handler) {
          el.removeEventListener('mousedown', handler);
          el.removeEventListener('touchstart', handler);
        }
      }
    };
  }, []);

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
          widgetIdRef.current = undefined;
        }
      } catch {}
    };
  }, [siteKey, renderWidget]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Placeholder discret — le widget Turnstile apparaîtra uniquement
          quand l'utilisateur interagit avec le formulaire */}
      {status === 'idle' && (
        <div
          className="flex items-center gap-2 h-[65px] px-4 rounded-lg border border-dashed"
          style={{ borderColor: `${NAVY}30`, color: NAVY }}
        >
          <Shield className="w-4 h-4" />
          <span className="text-xs">Cochez la case ci-dessous pour vérifier que vous êtes humain</span>
        </div>
      )}

      {/* Container pour le widget Turnstile natif — toujours visible */}
      <div
        ref={widgetRef}
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
