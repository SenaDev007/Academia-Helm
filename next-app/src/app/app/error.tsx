/**
 * App Module Error Boundary
 *
 * Catches runtime errors from any module page (HR, Academics, Finance, etc.)
 * and displays a recoverable error UI without crashing the entire app.
 * This prevents a bug in one module from making all modules inaccessible.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

function isChunkLoadError(message: string): boolean {
  return (
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('loading chunk failed')
  );
}

export default function AppModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Module Error Boundary]', error);
  }, [error]);

  const isChunkError = isChunkLoadError(error?.message || '');

  // Auto-reload on chunk errors (stale deployment cache)
  useEffect(() => {
    if (isChunkError && typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
      setTimeout(() => window.location.reload(), 500);
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Mise à jour en cours</h2>
          <p className="text-sm text-slate-600 mb-4">Une nouvelle version est disponible. Rechargement en cours...</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
          >
            <RefreshCw className="h-4 w-4" /> Recharger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Erreur du module</h2>
        <p className="text-sm text-slate-600 mb-4">
          Une erreur s&apos;est produite dans ce module. Les autres modules restent accessibles.
        </p>
        {error?.message && (
          <div className="mb-4 text-left bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 break-words">
            <p className="font-semibold mb-1">Détail :</p>
            <pre className="whitespace-pre-wrap">{error.message}</pre>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
