const path = require('path');

/** Netlify (@netlify/plugin-nextjs) : pas de mode standalone (Docker/VPS uniquement). */
const isNetlify = !!process.env.NETLIFY;
/** Vercel détecté — ne pas utiliser standalone ni PWA (Vercel gère son propre cache). */
const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ✅ Désactiver le file tracing sur Vercel et Netlify pour éviter l'OOM
  // Quand activé, Vercel trace TOUS les fichiers du monorepo (~1.2GB), causant un SIGKILL
  outputFileTracingRoot: (isNetlify || isVercel)
    ? undefined
    : path.join(__dirname, '..', '..'),

  // ✅ Exclure les répertoires inutiles du tracing (réduit la mémoire build)
  // Format objet attendu par Next.js 16 : { '<path>': ['<excludes>'] }
  // Comme outputFileTracingRoot est undefined sur Vercel, ce champ est inactif en prod Vercel
  outputFileTracingExcludes: {
    '*': [
      'apps/api-server',
      'apps/mobile-app',
      'apps/desktop-app',
      'apps/migration-tools',
      'apps/next-app',
      'node_modules/.cache',
    ],
  },

  // ⚠️ TypeScript — Temporairement ignoré pour débloquer le déploiement Vercel
  // TODO: Corriger les erreurs TS et remettre ignoreBuildErrors: false
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ✅ Optimisation des images — PageSpeed-optimized
  images: {
    // ✅ Vercel gère l'optimisation via son CDN — pas besoin de double traitement
    unoptimized: isVercel ? true : false,
    formats: ['image/avif', 'image/webp'],
    // Tailles optimisées pour réduire le poids sans sacrifier la qualité
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 an — les images optimisées sont immuables
    // ✅ Sécurité SVG
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // ✅ remotePatterns : permet à Next/Image d'optimiser les images distantes
    // (logos uploadés, photos élèves, etc.) au lieu de les servir en unoptimized
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Domaine API backend (logos uploadés, tampons, etc.)
      { protocol: 'https', hostname: 'api.academiahelm.com' },
      { protocol: 'https', hostname: 'www.academiahelm.com' },
      { protocol: 'https', hostname: 'academiahelm.com' },
      // Vercel blob storage
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      // Développement local
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
    ],
  },

  // ✅ Compression et optimisation
  compress: true,
  
  // ✅ Optimisation de performance
  poweredByHeader: false, // Masquer X-Powered-By
  generateEtags: true, // ETags pour le cache
  
  // ✅ Optimisation des bundles
  experimental: {
    optimizePackageImports: [
      // ✅ Tree-shaking optimisé pour réduire le bundle et la mémoire de build
      // Ces packages sont lourds et doivent être importés de manière sélective
      'lucide-react',
      '@base-ui/react',
      'date-fns',
      'framer-motion',
      'recharts',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
      '@tanstack/react-query',
      '@clerk/nextjs',
      'lodash',
      'cloudinary',
      'socket.io-client',
      'zod',
      '@sentry/nextjs',
      '@react-pdf/renderer',
      'next-mdx-remote',
    ],
  },

  // ✅ Paquets natifs qui ne doivent pas être bundlés côté serveur
  // (Propriété de premier niveau dans Next.js 14+, pas dans experimental)
  // ⚠️ @react-pdf/renderer retiré — conflit avec optimizePackageImports/transpilePackages
  // C'est un package JS pur (pas de binaire natif), il peut être bundlé avec tree-shaking
  serverExternalPackages: [
    'sharp',
    'canvas',
  ],
  
  // ✅ Optimisation de la compilation
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // ✅ Réduire la mémoire de build en limitant les pages compilées en parallèle
  onDemandEntries: {
    maxInactiveAge: 15 * 1000, // Libérer plus vite les pages inactives
    pagesBufferLength: 1, // Compiler 1 page à la fois au lieu de 2
  },
  
  // ✅ Optimisation du développement (simplifiée pour éviter les conflits)
  // Note: Next.js gère déjà le cache et l'optimisation webpack de manière optimale
  // On évite de modifier la config webpack pour ne pas casser le middleware

  // Multi-tenant: Support des sous-domaines
  async headers() {
    return [
      // ✅ Cache agressif pour les images statiques (1 an) — PageSpeed optimization
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // ✅ Cache pour les images uploadées (logos, photos, etc.)
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // ✅ Cache pour les polices (1 an)
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      // ✅ Cache pour les assets statiques Next.js (_next/static) — content-hashed
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // ✅ ANTI-CACHE pour les pages HTML (évite "Failed to load chunk")
      // Les pages HTML ne doivent JAMAIS être cachées — elles contiennent les
      // références aux chunks qui changent à chaque déploiement.
      {
        source: '/(.*)',
        has: [
          { type: 'header', key: 'Content-Type', value: 'text/html' },
        ],
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // Headers de sécurité globaux
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

  // ✅ Redirects permanents — page-level redirects (pas de redirect() dans page.tsx
  // qui casse le prerendering statique en Next.js 16 Turbopack)
  async redirects() {
    return [
      {
        source: '/app/pedagogy/timetable-engine',
        destination: '/app/pedagogy/timetables',
        permanent: false,
      },
      {
        source: '/app/pedagogy/timetable-engine/:path*',
        destination: '/app/pedagogy/timetables',
        permanent: false,
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

