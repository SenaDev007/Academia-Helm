/**
 * Next.js Middleware
 *
 * Gestion du multi-tenant et protection des routes.
 * Authentification via cookies API (academia_session / academia_token).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SubscriptionStatus } from './types';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';

const SESSION_COOKIE = 'academia_session';

// ─── Tenant resolution cache (Edge-compatible in-memory Map) ──────────────
// Tenant data rarely changes — cache for 60s to avoid API call on every navigation.
const TENANT_CACHE_TTL_MS = 60_000;
const tenantCache = new Map<string, { data: { id: string; slug: string; status: string; subscriptionStatus?: SubscriptionStatus } | null; ts: number }>();

/** Récupère l'utilisateur et le tenant depuis le cookie de session (Edge). */
function getUserFromSessionCookie(request: NextRequest): { 
  id: string; 
  tenantId?: string;
  isPlatformOwner?: boolean;
  tenantSlug?: string;
} | null {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const session = JSON.parse(sessionCookie) as { 
      user?: { 
        id?: string; 
        tenantId?: string;
        isPlatformOwner?: boolean;
        role?: string;
      }; 
      tenant?: { 
        id?: string;
        slug?: string;
        subdomain?: string;
      };
      expiresAt?: string 
    };
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
    if (session?.user?.id) {
      const isPlatformOwner = session.user.isPlatformOwner || session.user.role === 'PLATFORM_OWNER';
      return { 
        id: session.user.id,
        tenantId: session.user.tenantId || session.tenant?.id,
        isPlatformOwner,
        tenantSlug: session.tenant?.slug || session.tenant?.subdomain,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function extractSubdomainFromRequest(request: NextRequest): string | null {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');

  if (!host) return null;

  // En développement local, on peut forcer le subdomain via un header
  if (process.env.NODE_ENV === 'development') {
    const devSubdomain = request.headers.get('x-tenant-subdomain');
    if (devSubdomain) return devSubdomain;
  }

  const parts = host.split('.');
  
  // Liste des sous-domaines à ignorer (qui ne sont pas des tenants)
  const ignoredSubdomains = ['www', 'dev', 'test', 'staging', 'preview', 'admin', 'api', 'portal', 'app'];

  // Cas spécial pour localhost (développement avec sous-domaines type school.localhost)
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Si parts.length >= 2 (ex: school.localhost:3001)
    if (parts.length >= 2 && !ignoredSubdomains.includes(parts[0]) && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null;
  }

  // Cas standard (Production/Preview) : school.academiahelm.com
  // Si parts.length >= 3, on prend la première partie
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (!ignoredSubdomains.includes(subdomain)) {
      return subdomain;
    }
    
    // Support multi-niveaux : school.dev.academiahelm.com
    if (parts.length >= 4) {
      // Si la deuxième partie est un domaine ignoré (ex: dev, test), 
      // alors la première est quand même le tenant
      if (ignoredSubdomains.includes(parts[1])) {
        return parts[0];
      }
    }
  }

  return null;
}

async function resolveTenant(subdomain: string): Promise<{ id: string; slug: string; status: string; subscriptionStatus?: SubscriptionStatus } | null> {
  try {
    // Edge-compatible in-memory cache: tenant data rarely changes
    const cached = tenantCache.get(subdomain);
    if (cached && Date.now() - cached.ts < TENANT_CACHE_TTL_MS) {
      return cached.data;
    }

    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Cache negative results briefly to avoid hammering the API
      tenantCache.set(subdomain, { data: null, ts: Date.now() });
      return null;
    }

    const tenant = await response.json();

    if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
      tenantCache.set(subdomain, { data: null, ts: Date.now() });
      return null;
    }
    if (!tenant.subscriptionStatus && (tenant.status !== 'active' && tenant.status !== 'trial')) {
      tenantCache.set(subdomain, { data: null, ts: Date.now() });
      return null;
    }

    // Cache positive results for 60 seconds
    tenantCache.set(subdomain, { data: tenant, ts: Date.now() });
    return tenant;
  } catch (error) {
    console.error('Error resolving tenant in middleware:', error);
    return null;
  }
}

const publicRoutes = [
  '/en',
  '/modules',
  '/tarification',
  '/securite',
  '/contact',
  '/signup',
  '/login',
  '/admin-login', // Route publique pour le login Super Admin
  '/forgot-password',
  '/onboarding-error',
  '/onboarding',
  '/testimonials', // Route publique pour les témoignages
  '/avis', // Formulaire public pour laisser un avis
];

/**
 * Ajoute les headers anti-cache Cloudflare à une réponse.
 * Appliqué uniquement aux routes dynamiques (app, API) — les pages publiques
 * (landing, pricing, blog) bénéficient du cache CDN pour un TTFB plus rapide.
 */
function withAntiCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Accel-Buffering', 'no'); // Empêche le buffering par reverse-proxy (nginx/Cloudflare)
  return response;
}

/**
 * Headers pour les pages publiques — permet le cache CDN (5 min) pour un TTFB rapide.
 * Le contenu statique (landing, pricing, blog, legal) change rarement.
 */
function withPublicCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
  response.headers.set('X-Accel-Buffering', 'no');
  return response;
}

// Routes admin (ne nécessitent pas de subdomain)
const adminRoutes = [
  '/admin',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomainFromRequest(request);

  // Routes Patronat (Academia Federis) : utiliser le middleware dédié
  if (pathname.startsWith('/patronat') || pathname.startsWith('/federis')) {
    const { patronatMiddleware } = await import('./middleware-patronat');
    return patronatMiddleware(request);
  }

  // API routes : ajouter les headers anti-cache Cloudflare uniquement
  // (pas de résolution de tenant, pas de redirection — logique propre aux route handlers)
  if (pathname.startsWith('/api/')) {
    const apiResponse = NextResponse.next();
    apiResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    apiResponse.headers.set('Pragma', 'no-cache');
    apiResponse.headers.set('X-Accel-Buffering', 'no');
    return apiResponse;
  }

  const response = withAntiCacheHeaders(NextResponse.next());

  // Determine if this is a public (cacheable) page
  const isPublicPage = pathname === '/' || publicRoutes.some(route => pathname.startsWith(route)) ||
    pathname.startsWith('/jobs') || pathname.startsWith('/portal');

  const user = getUserFromSessionCookie(request);

  // Routes admin : pas de vérification de subdomain
  if (pathname.startsWith('/admin')) {
    const adminResponse = withAntiCacheHeaders(NextResponse.next());
    adminResponse.headers.set('x-pathname', pathname);
    if (user) {
      adminResponse.headers.set('x-user-id', user.id);
    }
    return adminResponse;
  }

  // Route admin-login : toujours accessible, même avec subdomain
  if (pathname === '/admin-login' || pathname.startsWith('/admin-login')) {
    return response;
  }

  // Assets statiques : ne jamais appliquer le multi-tenant/redirect
  if (
    pathname.startsWith('/images/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/uploads/') ||
    pathname === '/sw.js' ||
    pathname === '/workbox-*.js' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return isPublicPage ? withPublicCacheHeaders(NextResponse.next()) : response;
  }

  // Route racine `/` toujours accessible — page publique cacheable
  if (pathname === '/') {
    return withPublicCacheHeaders(NextResponse.next());
  }

  // Routes publiques — cache CDN pour un TTFB rapide
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    
    if (!subdomain) {
      return withPublicCacheHeaders(NextResponse.next());
    }

    if (subdomain && !pathname.startsWith('/app') && !pathname.startsWith('/admin')) {
      const mainDomain = getAppBaseUrl();
      const targetUrl = new URL(pathname, mainDomain);
      if (request.nextUrl.origin !== targetUrl.origin) {
        return NextResponse.redirect(targetUrl);
      }
    }
  }

  // Routes app (nécessitent un subdomain ou tenant_id)
  if (pathname.startsWith('/app')) {
    // En local, vérifier le paramètre tenant dans l'URL
    const isLocal = process.env.NODE_ENV === 'development';
    const tenantParam = request.nextUrl.searchParams.get('tenant');
    const tenantIdParam = request.nextUrl.searchParams.get('tenant_id');
    
    // Si pas de subdomain ET pas de tenant param → vérifier la session
    if (!subdomain && !tenantParam && !tenantIdParam) {
      // Si la session contient un tenant valide, autoriser l'accès
      if (user?.tenantId) {
        // Ajouter le tenant dans l'URL pour cohérence
        // Utiliser le slug depuis la session si disponible, sinon tenantId (UUID)
        const url = request.nextUrl.clone();
        const tenantSlug = user.tenantSlug || user.tenantId;
        url.searchParams.set('tenant', tenantSlug);
        // Ajouter tenant_id si on utilise le slug
        if (user.tenantSlug && user.tenantId) {
          url.searchParams.set('tenant_id', user.tenantId);
        }
        return NextResponse.redirect(url);
      }
      
      // Si PLATFORM_OWNER (pas de tenantId mais session valide), autoriser /app
      if (user?.id && user.isPlatformOwner) {
        return response; // Autoriser l'accès à /app pour PLATFORM_OWNER
      }
      
      const mainDomain = getAppBaseUrl();
      
      // Logger la tentative d'accès sans tenant
      try {
        const logUrl = `${getApiBaseUrl()}/portal/access-log`;
        fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: pathname,
            reason: 'NO_TENANT',
            ipAddress: (request as any).ip || request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => {}); // Ne pas bloquer sur erreur de logging
      } catch {}
      
      return NextResponse.redirect(new URL('/portal', mainDomain));
    }

    // En local/sans sous-domaine, après login réussi, prioriser le tenant de session.
    // Cela évite les faux "tenant-not-found" quand l'URL contient un UUID tenant_id.
    if (!subdomain && user?.tenantId) {
      const sameTenantById = tenantIdParam ? tenantIdParam === user.tenantId : true;
      const sameTenantBySlug = tenantParam
        ? tenantParam === user.tenantSlug || tenantParam === user.tenantId
        : true;

      if (sameTenantById && sameTenantBySlug) {
        const tenantResponse = withAntiCacheHeaders(NextResponse.next());
        tenantResponse.headers.set('X-Tenant-ID', user.tenantId);
        if (user.tenantSlug) {
          tenantResponse.headers.set('X-Tenant-Slug', user.tenantSlug);
        }
        tenantResponse.headers.set('X-User-ID', user.id);
        return tenantResponse;
      }
    }

    // Résoudre le tenant (subdomain ou param)
    const tenantIdentifier = subdomain || tenantParam || tenantIdParam;
    
    if (!tenantIdentifier) {
      const mainDomain = getAppBaseUrl();
      return NextResponse.redirect(new URL('/portal', mainDomain));
    }

    try {
      const tenant = await resolveTenant(tenantIdentifier);

      if (!tenant) {
        const mainDomain = getAppBaseUrl();
        
        // Logger la tentative d'accès à un tenant inexistant
        try {
          const logUrl = `${getApiBaseUrl()}/portal/access-log`;
          fetch(logUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: pathname,
              tenantIdentifier,
              reason: 'TENANT_NOT_FOUND',
              ipAddress: (request as any).ip || request.headers.get('x-forwarded-for'),
              userAgent: request.headers.get('user-agent'),
              timestamp: new Date().toISOString(),
            }),
            keepalive: true,
          }).catch(() => {});
        } catch {}
        
        return NextResponse.redirect(new URL('/tenant-not-found', mainDomain));
      }

      // Vérifier que le tenant est actif
      if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
        const mainDomain = getAppBaseUrl();
        return NextResponse.redirect(new URL('/tenant-not-found', mainDomain));
      }

      // Créer une nouvelle réponse pour ajouter les headers
      const tenantResponse = withAntiCacheHeaders(NextResponse.next());
      tenantResponse.headers.set('X-Tenant-ID', tenant.id);
      tenantResponse.headers.set('X-Tenant-Slug', tenant.slug);
      if (tenant.subscriptionStatus) {
        tenantResponse.headers.set('X-Tenant-Subscription-Status', tenant.subscriptionStatus);
      }
      if (user) {
        tenantResponse.headers.set('X-User-ID', user.id);
      }

      // Logger l'accès réussi
      try {
        const logUrl = `${getApiBaseUrl()}/portal/access-log`;
        fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: pathname,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            reason: 'SUCCESS',
            ipAddress: (request as any).ip || request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
            userId: user?.id,
            timestamp: new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}

      return tenantResponse;
    } catch (error) {
      console.error('Error resolving tenant in middleware:', error);
      const mainDomain = getAppBaseUrl();
      return NextResponse.redirect(new URL('/tenant-not-found', mainDomain));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Inclut /api/* pour ajouter les headers anti-cache Cloudflare
    // (essentiel après migration Cloudflare pour éviter le cache des réponses API)
    '/((?!_next/static|_next/image|favicon.ico|images/|fonts/|uploads/|sw.js|manifest.json|robots.txt|sitemap.xml).*)',
  ],
};
