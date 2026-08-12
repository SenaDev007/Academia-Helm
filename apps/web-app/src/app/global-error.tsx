/**
 * Global Error Boundary
 *
 * Gestion des erreurs critiques au niveau racine.
 *
 * ⭐ OFFLINE-FIRST : détecte si l'erreur est due à une perte de connexion
 *    et propose un bouton "Continuer hors ligne" qui recharge /app depuis
 *    le cache du Service Worker + IndexedDB.
 */

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  // ⭐ Détecter si l'erreur est réseau / offline
  const isOffline =
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('ERR_NETWORK') ||
    error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('Load failed');

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {isOffline ? (
              <>
                {/* Mode offline — erreur réseau */}
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">
                  Connexion interrompue
                </h1>
                <p className="text-slate-600 mb-6">
                  Votre connexion Internet a été interrompue. Vous pouvez continuer
                  à utiliser Academia Helm en mode hors ligne — vos données sont
                  sauvegardées localement et seront synchronisées au retour du réseau.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      window.location.href = '/app';
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Continuer hors ligne
                  </button>
                  <button
                    onClick={reset}
                    className="text-slate-500 px-6 py-2 rounded-lg font-medium hover:bg-slate-100 transition-colors"
                  >
                    Réessayer la connexion
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Erreur critique non réseau */}
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">
                  Erreur critique
                </h1>
                <p className="text-slate-600 mb-6">
                  Une erreur inattendue s'est produite. Veuillez recharger la page.
                </p>
                {error?.digest && (
                  <p className="text-xs text-slate-400 mb-4 font-mono">
                    Code : {error.digest}
                  </p>
                )}
                <button
                  onClick={reset}
                  className="bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                >
                  Recharger la page
                </button>
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
