/**
 * 404 Page
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-navy-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-navy-900 mb-4">
          Page non trouvée
        </h2>
        <p className="text-slate-600 mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-block bg-navy-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-navy-800 transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

