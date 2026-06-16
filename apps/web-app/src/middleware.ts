/**
 * Next.js Middleware
 *
 * Gestion du multi-tenant et protection des routes.
 * Authentification via cookies API (academia_session / academia_token).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SubscriptionStatus } from './types';
import { RESERVED_SUBDOMAINS, isReservedSubdomain, extractTenantSlug } from './lib/tenant/constants';
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
  // Importée depuis la source centrale : lib/tenant/constants.ts

  // Cas spécial pour localhost (développement avec sous-domaines type school.localhost)
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Si parts.length >= 2 (ex: school.localhost:3001)
    if (parts.length >= 2 && !isReservedSubdomain(parts[0]) && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null;
  }

  // Cas standard (Production/Preview) : school.academiahelm.com
  // Si parts.length >= 3, on prend la première partie
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (!isReservedSubdomain(subdomain)) {
      return subdomain;
    }
    
    // Support multi-niveaux : school.dev.academiahelm.com
    if (parts.length >= 4) {
      // Si la deuxième partie est un domaine ignoré (ex: dev, test), 
      // alors la première est quand même le tenant
      if (RESERVED_SUBDOMAINS.includes(parts[1] as any)) {
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
  '/reset-password',
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
  '/forgot-password',
  '/reset-password',
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

/** Nombre maximal de redirections internes avant de considérer une boucle. */
const MAX_REDIRECT_DEPTH = 5;

/**
 * Effectue une redirection en incrémentant le compteur de profondeur.
 * Si la profondeur dépasse MAX_REDIRECT_DEPTH, on renvoie une page d'erreur
 * au lieu de rediriger (protection anti-boucle).
 */
function safeRedirect(url: URL | string, request: NextRequest, currentDepth: number): NextResponse {
  const nextDepth = currentDepth + 1;
  if (nextDepth > MAX_REDIRECT_DEPTH) {
    const errorResponse = withAntiCacheHeaders(
      NextResponse.rewrite(new URL('/error/too-many-redirects', request.nextUrl.origin))
    );
    errorResponse.cookies.delete('x-redirect-depth');
    return errorResponse;
  }
  const redirectResponse = NextResponse.redirect(url);
  redirectResponse.cookies.set('x-redirect-depth', String(nextDepth), {
    path: '/',
    maxAge: 30, // 30 secondes — expire rapidement si pas de boucle
    sameSite: 'lax',
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Protection contre les boucles de redirection ──────────────────────
  // On utilise un cookie court-lived pour compter les redirections successives.
  // Si on dépasse MAX_REDIRECT_DEPTH, on renvoie une page d'erreur au lieu de rediriger.
  const redirectDepth = parseInt(request.cookies.get('x-redirect-depth')?.value || '0', 10);
  if (redirectDepth >= MAX_REDIRECT_DEPTH) {
    // Nettoyer le cookie et afficher une page d'erreur
    const errorResponse = withAntiCacheHeaders(NextResponse.rewrite(new URL('/error/too-many-redirects', request.nextUrl.origin)));
    errorResponse.cookies.delete('x-redirect-depth');
    return errorResponse;
  }

  const subdomain = extractSubdomainFromRequest(request);

  // ── Redirect reserved subdomains to main domain ──────────────────────
  // If user is on app.academiahelm.com, redirect to academiahelm.com
  // EXCEPTION: 'www' is NOT redirected because it's a common alias for the
  // main domain. Many hosting providers (Vercel, Cloudflare) redirect the
  // bare domain to www (or vice versa), so redirecting www → bare domain
  // creates an infinite loop. Instead, we treat www as equivalent to the
  // main domain by simply passing the request through.
  // EXCEPTION: 'academiafederis' is a satellite app — rewrite to /federis
  // instead of redirecting, so the subdomain stays visible in the URL bar.
  const host = request.headers.get('host') || '';
  const hostParts = host.split(':')[0].split('.');
  // Lecture du user session avant tout — nécessaire pour le bloc admin subdomain
  // ci-dessous (vérification isPlatformOwner sur admin.academiahelm.com).
  const user = getUserFromSessionCookie(request);
  if (hostParts.length >= 3 && isReservedSubdomain(hostParts[0]) && hostParts[0] !== 'www') {
    // ── Academia Federis satellite app ──
    if (hostParts[0] === 'academiafederis') {
      // Rewrite academiafederis.academiahelm.com/* → /federis/*
      // Root path → /federis
      // Sub-paths → /federis/<path> (unless already prefixed)
      let federisPath: string;
      if (pathname === '/') {
        federisPath = '/federis';
      } else if (pathname.startsWith('/federis')) {
        // Already has /federis prefix — use as-is (e.g. old bookmark)
        federisPath = pathname;
      } else {
        federisPath = `/federis${pathname}`;
      }
      const rewriteUrl = new URL(federisPath + request.nextUrl.search, request.nextUrl.origin);
      const federisResponse = withAntiCacheHeaders(NextResponse.rewrite(rewriteUrl));
      // Set header so downstream knows this came from the satellite subdomain
      federisResponse.headers.set('x-federis-subdomain', 'true');
      return federisResponse;
    }

    // ── Admin subdomain: back-office centralisé d'Academia Helm ──
    // admin.academiahelm.com/* est volontairement laissé passer sans redirection.
    // Les routes /app/platform/* sont réservées à ce sous-domaine.
    // L'authentification forte (rôle PLATFORM_OWNER / PLATFORM_SUPER_ADMIN) est
    // vérifiée côté layout + page (cf. /app/platform/layout.tsx) et dans le
    // cookie de session lu par getUserFromSessionCookie().
    if (hostParts[0] === 'admin') {
      // Routes toujours accessibles même sans auth : login, assets, API.
      const isAdminLoginRoute = pathname === '/admin-login' || pathname.startsWith('/admin-login/');
      const isRegularLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
      const isPublicAsset =
        pathname.startsWith('/images/') ||
        pathname.startsWith('/fonts/') ||
        pathname.startsWith('/uploads/') ||
        pathname === '/sw.js' ||
        pathname === '/manifest.json' ||
        pathname === '/robots.txt' ||
        pathname === '/favicon.ico';

      if (isAdminLoginRoute || isRegularLoginRoute || isPublicAsset || pathname.startsWith('/api/')) {
        const adminResponse = withAntiCacheHeaders(NextResponse.next());
        adminResponse.headers.set('x-admin-subdomain', 'true');
        if (user) {
          adminResponse.headers.set('x-user-id', user.id);
          if (user.isPlatformOwner) adminResponse.headers.set('x-platform-owner', 'true');
        }
        return adminResponse;
      }

      if (!user?.id || !user.isPlatformOwner) {
        // Rediriger vers la page de connexion principale (les PLATFORM_OWNER
        // s'authentifient via /login, pas /admin-login qui est réservé SUPER_ADMIN).
        // Le paramètre redirect=?admin indique au LoginPage de renvoyer l'utilisateur
        // vers admin.academiahelm.com après connexion réussie.
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const mainDomain = hostParts.slice(1).join('.');
        const loginUrl = new URL('/login', `${protocol}://${mainDomain}`);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set('admin', '1');
        return safeRedirect(loginUrl, request, redirectDepth);
      }

      // Utilisateur authentifié avec rôle plateforme → laisser passer
      const adminResponse = withAntiCacheHeaders(NextResponse.next());
      adminResponse.headers.set('x-admin-subdomain', 'true');
      adminResponse.headers.set('x-platform-owner', 'true');
      adminResponse.headers.set('x-user-id', user.id);
      return adminResponse;
    }

    const mainDomain = hostParts.slice(1).join('.');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const redirectUrl = new URL(pathname + request.nextUrl.search, `${protocol}://${mainDomain}`);
    return safeRedirect(redirectUrl, request, redirectDepth);
  }

  // ── Bloquer l'accès aux routes /app/platform/* hors du sous-domaine admin ──
  // Le back-office centralisé d'Academia Helm ne doit être accessible QUE via
  // admin.academiahelm.com. Toute tentative d'accès depuis un autre sous-domaine
  // ou le domaine principal est redirigée vers admin.academiahelm.com.
  if (pathname.startsWith('/app/platform')) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const mainDomain = hostParts.length >= 2 ? hostParts.slice(1).join('.') : 'academiahelm.com';
    const adminUrl = new URL(pathname + request.nextUrl.search, `${protocol}://admin.${mainDomain}`);
    return safeRedirect(adminUrl, request, redirectDepth);
  }

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
  // on REWRITE (pas redirect) vers /school-portal pour afficher les options
  // de connexion spécifiques à cette école.
  // Utiliser rewrite au lieu de redirect évite les boucles de redirection
  // si le client redirige vers / après une erreur de login.
  if (pathname === '/') {
    if (subdomain && !user?.id) {
      // Sur un sous-domaine sans session → school portal selector
      // Utiliser rewrite pour éviter les boucles de redirection
      const rewriteUrl = new URL('/school-portal', request.nextUrl.origin);
      return NextResponse.rewrite(rewriteUrl);
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
        return safeRedirect(targetUrl, request, redirectDepth);
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
        return safeRedirect(url, request, redirectDepth);
      }
      
      // PLATFORM_OWNER sans tenantId → rediriger vers le portail pour sélectionner une école
      // Même le PLATFORM_OWNER doit toujours être dans le contexte d'un tenant (sous-domaine professionnel)
      if (user?.id && user.isPlatformOwner) {
        const mainDomain = getAppBaseUrl();
        return safeRedirect(new URL('/portal', mainDomain), request, redirectDepth);
      }
      
      const mainDomain = getAppBaseUrl();
      return safeRedirect(new URL('/portal', mainDomain), request, redirectDepth);
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
      return safeRedirect(new URL('/portal', mainDomain), request, redirectDepth);
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
        return safeRedirect(new URL('/tenant-not-found', mainDomain), request, redirectDepth);
      }

      // Vérifier que le tenant est actif
      if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
        const mainDomain = getAppBaseUrl();
        return safeRedirect(new URL('/tenant-not-found', mainDomain), request, redirectDepth);
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
      return safeRedirect(new URL('/tenant-not-found', mainDomain), request, redirectDepth);
    }
  }

  // Réinitialiser le compteur de redirection pour les réponses normales
  // (pas de redirection → pas de boucle possible)
  if (redirectDepth > 0) {
    response.cookies.delete('x-redirect-depth');
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
