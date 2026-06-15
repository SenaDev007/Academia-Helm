/**
 * Page: Tenant non trouvé
 * 
 * Affichée quand le sous-domaine ne correspond à aucun tenant valide
 */

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function TenantNotFoundPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-navy-900 mb-4">
          Établissement non trouvé
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Le sous-domaine que vous utilisez ne correspond à aucun établissement actif.
        </p>
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-block bg-navy-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-navy-800 transition-colors"
          >
            Retour à l'accueil
          </Link>
          <p className="text-sm text-gray-500">
            Si vous pensez qu'il s'agit d'une erreur, contactez le support.
          </p>
        </div>
      </div>
    </div>
  );
}

