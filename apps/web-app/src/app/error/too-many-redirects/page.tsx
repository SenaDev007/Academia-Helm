'use client';

/**
 * Page d'erreur : Boucle de redirection détectée
 *
 * Affichée quand le middleware détecte que le navigateur a été redirigé
 * trop de fois (plus de 5 redirections consécutives).
 * Client Component nécessaire pour le onClick (suppression cookies).
 */
import Link from 'next/link';

export default function TooManyRedirectsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Trop de redirections
        </h1>

        <p className="text-gray-600 mb-2">
          Le site a détecté une boucle de redirection. Cela peut arriver en raison
          d&apos;un conflit de configuration entre le nom de domaine (www vs non-www)
          et les règles de routage.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 text-left">
          <h2 className="font-semibold text-gray-800 mb-2">
            Comment résoudre ce problème :
          </h2>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>Supprimez les cookies de ce site dans votre navigateur</li>
            <li>Essayez d&apos;accéder au site sans le &quot;www&quot; dans l&apos;URL</li>
            <li>Si le problème persiste, contactez le support technique</li>
          </ol>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Retour &agrave; l&apos;accueil
          </Link>

          <button
            onClick={() => {
              // Supprimer les cookies de redirection et recharger
              // IMPORTANT : on spécifie le domaine parent pour que le navigateur
              // supprime effectivement le cookie (sinon il a été set avec
              // domain='.academiahelm.com' et document.cookie sans domaine ne le supprime pas).
              const hostParts = window.location.hostname.split('.');
              const parentDomain = hostParts.length >= 2
                ? '.' + hostParts.slice(-2).join('.')
                : '';
              const clearCookie = (name: string) => {
                document.cookie = `${name}=; path=/; max-age=0`;
                if (parentDomain) {
                  document.cookie = `${name}=; path=/; max-age=0; domain=${parentDomain}`;
                }
              };
              clearCookie('x-redirect-depth');
              clearCookie('x-resolved-tenant-id');
              clearCookie('x-resolved-tenant-slug');
              clearCookie('x-resolved-tenant-subdomain');
              window.location.href = '/';
            }}
            className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Effacer les cookies et r&eacute;essayer
          </button>
        </div>
      </div>
    </div>
  );
}
