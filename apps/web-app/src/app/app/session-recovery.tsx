'use client';

/**
 * Session Recovery Component
 *
 * When the server-side layout can't find a session cookie (common on mobile after
 * login due to cookie propagation delays), this client component attempts to
 * recover the session from localStorage before redirecting to /login.
 *
 * Flow:
 * 1. Check if localStorage has session data (accessToken + session)
 * 2. If yes, try to re-establish the server session by calling /api/auth/me
 * 3. If that works, reload the page (the server will now find the cookie)
 * 4. If not, redirect to /login with a helpful message
 *
 * This prevents the "blank white page" on mobile after authentication.
 */

import { useEffect, useState } from 'react';

type RecoveryState = 'checking' | 'recovering' | 'redirecting' | 'failed';

export function SessionRecovery() {
  const [state, setState] = useState<RecoveryState>('checking');

  useEffect(() => {
    let cancelled = false;

    async function recover() {
      // Step 1: Check localStorage for session hints
      const hasAccessToken = Boolean(localStorage.getItem('accessToken')?.trim());
      const hasSession = Boolean(localStorage.getItem('session')?.trim());

      if (!hasAccessToken && !hasSession) {
        // No local session data — genuinely not authenticated
        setState('redirecting');
        window.location.href = '/login';
        return;
      }

      // Step 2: Try to re-establish the server session
      setState('recovering');

      try {
        // The /api/auth/me endpoint will use the httpOnly cookie if available.
        // If the cookie wasn't propagated on the first page load, a retry here
        // gives the browser another chance to send it.
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (res.ok && !cancelled) {
          // Session is now accessible — reload the page so the server component
          // can read the cookie and render the authenticated layout
          window.location.reload();
          return;
        }
      } catch {
        // Network error — fall through to retry
      }

      // Step 3: Try to re-authenticate using the refresh token
      const refreshToken = localStorage.getItem('refreshToken')?.trim();
      if (refreshToken && !cancelled) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refreshToken }),
            cache: 'no-store',
          });

          if (refreshRes.ok && !cancelled) {
            // Refresh succeeded — reload to pick up the new session cookie
            window.location.reload();
            return;
          }
        } catch {
          // Refresh failed — fall through
        }
      }

      // Step 4: All recovery attempts failed — redirect to login
      if (!cancelled) {
        setState('failed');
        // Small delay so the user sees the message before redirect
        setTimeout(() => {
          window.location.href = '/login?reason=session_expired';
        }, 1500);
      }
    }

    recover();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 border-4 border-[#0b2f73] border-t-transparent rounded-full animate-spin mx-auto mb-5" />
        {state === 'checking' && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Vérification de la session…
            </h2>
            <p className="text-sm text-slate-500">
              Un instant, nous vérifions votre connexion.
            </p>
          </>
        )}
        {state === 'recovering' && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Récupération de la session…
            </h2>
            <p className="text-sm text-slate-500">
              Votre session est en cours de récupération. Vous serez redirigé(e) automatiquement.
            </p>
          </>
        )}
        {state === 'redirecting' && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Redirection…
            </h2>
            <p className="text-sm text-slate-500">
              Vous allez être redirigé(e) vers la page de connexion.
            </p>
          </>
        )}
        {state === 'failed' && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Session expirée
            </h2>
            <p className="text-sm text-slate-500">
              Votre session a expiré. Vous allez être redirigé(e) vers la page de connexion.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
