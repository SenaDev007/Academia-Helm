import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-10 h-10 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Vous êtes hors ligne
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Impossible de se connecter à Internet. Vérifiez votre connexion réseau.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Réessayer
          </button>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            Retour à l'accueil
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Astuce :</strong> Si vous avez installé l'application, certaines fonctionnalités peuvent être disponibles hors ligne.
          </p>
        </div>
      </div>
    </div>
  );
}
