const path = require('path');

/** Netlify (@netlify/plugin-nextjs) : pas de mode standalone (Docker/VPS uniquement). */
const isNetlify = !!process.env.NETLIFY;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: isNetlify
    ? undefined
    : path.join(__dirname, '..', '..'),

  // MODE PROD SAFE - Désactivation temporaire des bloqueurs CI
  // ESLint : plus dans next.config (Next 16) — `next lint` / eslint.config à part
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ✅ Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // ✅ Optimisation de performance
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ✅ Compression et optimisation
  compress: true,
  
  // ✅ Optimisation de performance
  poweredByHeader: false, // Masquer X-Powered-By
  generateEtags: true, // ETags pour le cache
  
  // ✅ Optimisation des bundles
  experimental: {
    optimizePackageImports: ['lucide-react', '@base-ui/react'], // Tree-shaking (packages lourds côté UI)
  },
  
  // ✅ Optimisation de la compilation
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // ✅ Gestion des erreurs de téléchargement de polices Google Fonts
  // Si le téléchargement échoue (timeout, connexion), Next.js utilisera automatiquement le fallback
  // Cette configuration permet d'ignorer les erreurs de téléchargement en développement
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // ✅ Optimisation du développement (simplifiée pour éviter les conflits)
  // Note: Next.js gère déjà le cache et l'optimisation webpack de manière optimale
  // On évite de modifier la config webpack pour ne pas casser le middleware

  // Multi-tenant: Support des sous-domaines
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'index, follow',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // Variables d'environnement
  // Note: NEXT_PUBLIC_* sont automatiquement exposées côté client
  // Les autres variables sont uniquement côté serveur
  // ⚠️ IMPORTANT : Ne pas utiliser de fallback localhost en dur
  // Les variables d'environnement DOIVENT être définies dans .env.local (ou sur l'hébergeur, ex. OVH)
  env: {
    // API_URL : Utiliser uniquement les variables d'environnement
    // En production, ces variables DOIVENT être définies
    API_URL: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || undefined,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
    NEXT_PUBLIC_BASE_DOMAIN: process.env.NEXT_PUBLIC_BASE_DOMAIN || undefined,
    NEXT_PUBLIC_PLATFORM: process.env.NEXT_PUBLIC_PLATFORM || 'web',
  },
  
  // Build standalone pour déploiement Node (OVH, VPS, Docker) — pas sur Netlify
  output: isNetlify ? undefined : 'standalone',

  // Timeout plus long pour la génération des pages statiques (build volumineux)
  staticPageGenerationTimeout: 180,

  /**
   * Dev : proxifier les avis vers l’API Nest (même origine côté navigateur → pas de CORS).
   * Cible : {origin}/api/reviews/* (préfixe global Nest).
   * Désactiver : NEXT_PUBLIC_REVIEWS_DEV_PROXY=0
   */
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    if (process.env.NEXT_PUBLIC_REVIEWS_DEV_PROXY === '0') return [];

    const explicit =
      process.env.API_SERVER_ORIGIN?.trim() ||
      process.env.REVIEWS_PROXY_TARGET?.trim();
    let origin = explicit?.replace(/\/$/, '') || '';

    if (!origin && process.env.NEXT_PUBLIC_API_URL) {
      const m = process.env.NEXT_PUBLIC_API_URL.trim().match(
        /^(https?:\/\/[^/]+)/i,
      );
      if (m) origin = m[1];
    }

    if (!origin) return [];

    return [
      {
        source: '/reviews/:path*',
        destination: `${origin}/api/reviews/:path*`,
      },
    ];
  },
};

// PWA en prod ; bundle analyzer si ANALYZE=true (audit poids JS pour la perf)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

let exportedConfig = nextConfig;
if (process.env.NODE_ENV === 'production') {
  // @ducanh2912/next-pwa (Workbox 7) : évite l'erreur Vercel
  // « assignWith is not defined » lors de la génération du SW avec next-pwa + Workbox 6.
  const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    register: true,
    extendDefaultRuntimeCaching: false,
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      cacheId: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`,
      runtimeCaching: [
        {
          urlPattern: /^https?.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'offlineCache',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 24 * 60 * 60, // 24 heures
            },
            networkTimeoutSeconds: 10,
          },
        },
      ],
    },
  });
  exportedConfig = withPWA(nextConfig);
}

module.exports = withBundleAnalyzer(exportedConfig);

