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

/** Récupère l'utilisateur et le tenant depuis le cookie de session (Edge). */
function getUserFromSessionCookie(request: NextRequest): { 
  id: string; 
  tenantId?: string;
  isPlatformOwner?: boolean;
  tenantSlug?: string;
  portalType?: string;
  role?: string;
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
        portalType?: string;
      }; 
      tenant?: { 
        id?: string;
        slug?: string;
        subdomain?: string;
      };
      portalType?: string;
      expiresAt?: string 
    };
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
    if (session?.user?.id) {
      const isPlatformOwner = session.user.isPlatformOwner || session.user.role === 'PLATFORM_OWNER';
      const portalType = session.portalType || session.user.portalType;
      return { 
        id: session.user.id,
        tenantId: session.user.tenantId || session.tenant?.id,
        isPlatformOwner,
        tenantSlug: session.tenant?.slug || session.tenant?.subdomain,
        portalType,
        role: session.user.role,
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
    const apiUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const tenant = await response.json();

    if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
      return null;
    }
    if (!tenant.subscriptionStatus && (tenant.status !== 'active' && tenant.status !== 'trial')) {
      return null;
    }

    return tenant;
  } catch (error) {
    // Timeout ou erreur réseau — ne pas bloquer le rendu
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
  '/public/pre-enrollment', // Portail Public : pré-inscription (aucune auth requise)
  '/portal', // Page de sélection des portails
  '/school-portal', // Sélection portail spécifique à l'école (sous-domaine)
];

/**
 * Routes accessibles sur un sous-domaine d'école même sans session.
 * Ces routes présentent le contexte de l'école (login spécifique, sélection de portails).
 */
const schoolSubdomainPublicRoutes = [
  '/login',
  '/school-portal',
  '/public/pre-enrollment',
];

/**
 * Ajoute les headers anti-cache Cloudflare à une réponse.
 * Empêche le buffering et la mise en cache des réponses HTML,
 * ce qui est essentiel pour le streaming Next.js / Suspense (loading.tsx).
 */
function withAntiCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Accel-Buffering', 'no'); // Empêche le buffering par reverse-proxy (nginx/Cloudflare)
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

  const user = getUserFromSessionCookie(request);

  // Routes admin : pas de vérification de subdomain
  if (pathname.startsWith('/admin')) {
    // La vérification du rôle SUPER_ADMIN se fait dans le layout
    // Ajouter le pathname dans les headers pour le layout
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
  // (important sur Vercel/Linux + domaines preview)
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
    return response;
  }

  // ── Route racine `/` avec sous-domaine d'école ──
  // Si l'utilisateur accède à school.academiahelm.com/ sans session,
  // rediriger vers /school-portal pour afficher les options de connexion
  // spécifiques à cette école (au lieu du landing page générique).
  if (pathname === '/') {
    if (subdomain && !user?.id) {
      // Sur un sous-domaine sans session → school portal selector
      const schoolPortalUrl = new URL('/school-portal', request.nextUrl.origin);
      return NextResponse.redirect(schoolPortalUrl);
    }
    return response;
  }

  // Routes publiques
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    
    if (!subdomain) {
      return response;
    }

    // Sur un sous-domaine d'école : les routes spécifiques au contexte école
    // sont toujours accessibles même sans session (login, school-portal, pré-inscription)
    if (schoolSubdomainPublicRoutes.some(route => pathname.startsWith(route))) {
      return response;
    }

    // Autres routes publiques sur sous-domaine : accessibles si session valide
    if (subdomain && !pathname.startsWith('/app') && !pathname.startsWith('/admin')) {
      // Si l'utilisateur a une session valide, laisser passer
      if (user?.id) {
        return response;
      }
      // Sans session, rediriger vers le domaine principal pour éviter une boucle
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
      
      // PLATFORM_OWNER sans tenantId → rediriger vers le portail pour sélectionner une école
      // Même le PLATFORM_OWNER doit toujours être dans le contexte d'un tenant (sous-domaine professionnel)
      if (user?.id && user.isPlatformOwner) {
        const mainDomain = getAppBaseUrl();
        return NextResponse.redirect(new URL('/portal', mainDomain));
      }
      
      const mainDomain = getAppBaseUrl();
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

    // Check if tenant is already cached in cookies — skip API call
    const cachedTenantId = request.cookies.get('x-resolved-tenant-id')?.value;
    const cachedTenantSlug = request.cookies.get('x-resolved-tenant-slug')?.value;
    const cachedTenantForSubdomain = request.cookies.get('x-resolved-tenant-subdomain')?.value;

    if (cachedTenantId && cachedTenantSlug && cachedTenantForSubdomain === tenantIdentifier) {
      // Use cached tenant data instead of making an API call
      const cachedResponse = withAntiCacheHeaders(NextResponse.next());
      cachedResponse.headers.set('X-Tenant-ID', cachedTenantId);
      cachedResponse.headers.set('X-Tenant-Slug', cachedTenantSlug);
      if (user) {
        cachedResponse.headers.set('X-User-ID', user.id);
      }
      // Forward portal_type header for RBAC validation (conforme document)
      const portalParam = request.nextUrl.searchParams.get('portal');
      if (portalParam) {
        cachedResponse.headers.set('X-Portal-Type', portalParam.toUpperCase());
      } else if (user?.portalType) {
        cachedResponse.headers.set('X-Portal-Type', user.portalType);
      }
      return cachedResponse;
    }

    try {
      const tenant = await resolveTenant(tenantIdentifier);

      if (!tenant) {
        const mainDomain = getAppBaseUrl();
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

      // Forward portal_type header for RBAC validation (conforme document)
      const portalParam = request.nextUrl.searchParams.get('portal');
      if (portalParam) {
        tenantResponse.headers.set('X-Portal-Type', portalParam.toUpperCase());
      } else if (user?.portalType) {
        tenantResponse.headers.set('X-Portal-Type', user.portalType);
      }

      // Cache the resolved tenant info in cookies for future requests (30 minutes)
      const maxAge = 30 * 60; // 30 minutes
      tenantResponse.cookies.set('x-resolved-tenant-id', tenant.id, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-slug', tenant.slug, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-subdomain', tenantIdentifier, { path: '/', maxAge, sameSite: 'lax' });

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
