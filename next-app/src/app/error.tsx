/**
 * Error Boundary
 *
 * Gestion des erreurs globales — inclut la détection automatique
 * des erreurs de chunk (déploiement récent) avec rechargement forcé.
 */

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

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);

    // Auto-reload on chunk loading errors (stale cache after deployment)
    if (isChunkLoadError(error?.message || '')) {
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [error]);

  const isChunkError = isChunkLoadError(error?.message || '');

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6" />

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
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Recharger la page
            </button>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Une erreur s'est produite
            </h1>
            <p className="text-slate-600 mb-4">
              Désolé, une erreur inattendue s'est produite. Veuillez réessayer.
            </p>
            {error?.message && (
              <div className="mb-6 text-left bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 break-words">
                <p className="font-semibold mb-1">Détail technique (à copier pour le support) :</p>
                <pre className="whitespace-pre-wrap">{error.message}</pre>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={reset}
                className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 transition-colors"
              >
                Réessayer
              </button>
              <Link
                href="/"
                className="bg-gray-200 text-gray-900 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors"
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

