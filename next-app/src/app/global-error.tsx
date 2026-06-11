/**
 * Global Error Boundary
 * 
 * Gestion des erreurs critiques au niveau racine
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

  return (
    <html>
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-3xl font-bold text-navy-900 mb-4">
              Erreur critique
            </h1>
            <p className="text-slate-600 mb-8">
              Une erreur critique s'est produite. Veuillez recharger la page.
            </p>
            <button
              onClick={reset}
              className="bg-navy-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-navy-800 transition-colors"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

