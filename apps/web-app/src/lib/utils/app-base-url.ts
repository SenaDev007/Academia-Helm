/**
 * URL de base applicative — extrait pour éviter toute dépendance circulaire avec tenant-redirect.
 */

export type AppEnvironment = 'local' | 'production';

export function getAppEnvironment(): AppEnvironment {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    return 'production';
  }
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;
  if (env === 'development' || !env) return 'local';
  return 'production';
}

export function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return envUrl;
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
