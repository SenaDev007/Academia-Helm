/**
 * URL de base applicative — extrait pour éviter toute dépendance circulaire avec tenant-redirect.
 */

export type AppEnvironment = 'local' | 'preview' | 'test' | 'production' | 'development';

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
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) return 'local';
    if (hostname.includes('vercel.app') || hostname.includes('preview.')) return 'preview';
    if (hostname.includes('test.') || hostname.includes('dev.')) return 'test';
    return 'production';
  }
  // `NEXT_PUBLIC_ENV` peut valoir `local`, `preview`, `test`, `production`
  const env = (process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'local') as string;
  if (env === 'local' || env === 'development') return 'local';
  if (env === 'preview') return 'preview';
  if (env === 'test') return 'test';
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

  if (env === 'production' || env === 'preview' || env === 'test') {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      const cleanDomain = baseDomain.replace(/^https?:\/\//, '');
      const protocol = (env as string) === 'local' ? 'http' : 'https';
      return `${protocol}://${cleanDomain}`;
    }
    
    // Fallback pour preview si NEXT_PUBLIC_APP_URL n'est pas défini
    if (env === 'preview' && process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }

    if (env === 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_DOMAIN must be set in production. ' +
          'Please configure your environment variables.',
      );
    }
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
