import type { Metadata } from 'next';

/**
 * Balises hreflang pour la version française + x-default.
 * Optionnel : `NEXT_PUBLIC_HREFLANG_EN_URL` = URL complète de la version anglaise (ex. subdomain ou /en déployé).
 */
export function buildHreflangLanguages(siteUrl: string, pathSegment: string = ''): NonNullable<
  Metadata['alternates']
>['languages'] {
  const base = siteUrl.replace(/\/+$/, '');
  const path =
    !pathSegment || pathSegment === '/'
      ? ''
      : pathSegment.startsWith('/')
        ? pathSegment
        : `/${pathSegment}`;
  const explicitEn = process.env.NEXT_PUBLIC_HREFLANG_EN_URL?.trim();

  if (path === '/en') {
    return {
      fr: base,
      en: explicitEn || `${base}/en`,
      'x-default': base,
    };
  }

  const frUrl = `${base}${path}`;
  const isHome = !path || path === '/';

  const languages: Record<string, string> = {
    fr: frUrl,
    'x-default': frUrl,
  };

  if (explicitEn) {
    languages.en = explicitEn;
  } else if (isHome) {
    languages.en = `${base}/en`;
  }

  return languages;
}
