/**
 * URL de base applicative — extrait pour éviter toute dépendance circulaire avec tenant-redirect.
 */

export type AppEnvironment = 'local' | 'production';

/**
 * Pendant `next build`, NODE_ENV vaut souvent `production` alors que les
 * `NEXT_PUBLIC_*` ne sont pas encore disponibles sur le CI — évite de lever
 * lors du chargement des routes API (collecte des données de page).
 */
export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export function getAppEnvironment(): AppEnvironment {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    return 'production';
  }
  // `NEXT_PUBLIC_ENV` peut valoir `local`, `preview`, `staging`, etc.
  // Dans notre cas, `local` doit impérativement être traité comme environnement local,
  // sinon on construit des URLs de prod et les routes proxy peuvent boucler.
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;
  if (env === 'local' || env === 'development' || !env) return 'local';
  return 'production';
}

export function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return envUrl;
  }

  if (isNextProductionBuild()) {
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      const cleanDomain = baseDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}`;
    }
    return 'https://next-build.invalid';
  }

  const env = getAppEnvironment();

  if (env === 'production') {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      const cleanDomain = baseDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}`;
    }
    throw new Error(
      'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_DOMAIN must be set in production. ' +
        'Please configure your environment variables.',
    );
  }

  if (env === 'local') {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    const port = process.env.PORT || '3001';
    return `http://localhost:${port}`;
  }

  throw new Error(
    'Unable to determine app base URL. Please set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_DOMAIN.',
  );
}
