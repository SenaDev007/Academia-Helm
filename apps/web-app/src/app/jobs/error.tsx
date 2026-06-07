'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function isChunkLoadError(message: string): boolean {
  return (
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('loading chunk failed')
  );
}

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Jobs page error:', error);

    // Auto-reload on chunk loading errors (stale cache after deployment)
    if (isChunkLoadError(error?.message || '')) {
      // Clear the service worker cache and force a full page reload
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      // Small delay to let cache clear, then hard reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [error]);

  const isChunkError = isChunkLoadError(error?.message || '');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />

        {isChunkError ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Mise à jour en cours
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Une nouvelle version du site est disponible. La page va se recharger automatiquement...
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-[#1A2BA6] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Recharger la page
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Une erreur s'est produite
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              Désolé, une erreur inattendue s'est produite. Veuillez réessayer.
            </p>
            {error?.message && (
              <div className="mb-6 text-left bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 break-words">
                <p className="font-semibold mb-1">Détail technique :</p>
                <pre className="whitespace-pre-wrap">{error.message}</pre>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 bg-[#1A2BA6] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Réessayer
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
              >
                Retour à l'accueil
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
