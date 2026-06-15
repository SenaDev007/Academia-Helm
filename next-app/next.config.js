const path = require('path');

/** Netlify (@netlify/plugin-nextjs) : pas de mode standalone (Docker/VPS uniquement). */
const isNetlify = !!process.env.NETLIFY;
/** Vercel détecté — ne pas utiliser standalone ni PWA (Vercel gère son propre cache). */
const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: isNetlify
    ? undefined
    : path.join(__dirname, '..', '..'),

  // ⚠️ TypeScript strict — Ne pas ignorer les erreurs en production (CDC §17)
  // En cas d'erreurs TS bloquantes : les corriger plutôt que de les silencer
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ✅ Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 1 jour — permet de rafraîchir les logos modifiés sans attendre 1 an
    // ✅ Sécurité SVG
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
    optimizePackageImports: ['lucide-react', '@base-ui/react', 'date-fns', 'framer-motion'], // Tree-shaking (packages lourds)
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
  
  // Build standalone pour déploiement Node (OVH, VPS, Docker) — pas sur Netlify ni Vercel
  output: (isNetlify || isVercel) ? undefined : 'standalone',

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
let exportedConfig = nextConfig;

// Bundle analyzer — chargement conditionnel pour éviter MODULE_NOT_FOUND
// quand @next/bundle-analyzer n'est pas installé (ex: Vercel sans devDependencies)
if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
    });
    exportedConfig = withBundleAnalyzer(exportedConfig);
  } catch {
    console.warn('⚠️  @next/bundle-analyzer not installed — skipping bundle analysis');
  }
}

if (process.env.NODE_ENV === 'production' && !isVercel) {
  // @ducanh2912/next-pwa (Workbox 7) : Stratégie offline-first
  // StaleWhileRevalidate pour les API : réponse immédiate depuis le cache +
  // mise à jour en arrière-plan. Plus de timeout 10s qui bloque l'UI.
  // ⚠️ Désactivé sur Vercel : le plugin PWA injecte une config webpack qui
  // conflite avec Turbopack (Next.js 16 par défaut), et Vercel gère déjà le
  // cache via ses Edge Functions. Sur Vercel, le build utilise --webpack mais
  // le PWA Service Worker n'est pas nécessaire.
  try {
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
            urlPattern: /\/api\/(?!auth\/).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 300, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/_next\/static\/.+\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'next-static-chunks',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.html?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https?.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'offlineCache',
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    });
    exportedConfig = withPWA(exportedConfig);
  } catch {
    console.warn('⚠️  @ducanh2912/next-pwa not installed — skipping PWA support');
  }
}

module.exports = exportedConfig;

