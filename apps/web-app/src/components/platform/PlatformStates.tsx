'use client';

/**
 * PlatformState — composants UI partagés pour les workspaces platform.
 *
 * Affichent des états cohérents pour :
 *  - Loading (spinner)
 *  - Error (message + retry)
 *  - Empty (aucune donnée — Remplace les anciennes listes mock)
 */

import { Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';

export function PlatformLoading({ label = 'Chargement des données…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function PlatformError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-700 mb-1">Erreur de chargement</p>
        <p className="text-xs text-red-600 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

export function PlatformEmpty({
  title = 'Aucune donnée',
  description = "Aucune entrée n'est disponible pour le moment.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
        <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
