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
const ADMIN_SESSION_COOKIE = 'academia_admin_session';

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

/**
 * Récupère l'admin authentifié via le cookie dédié `academia_admin_session`.
 *
 * Système d'authentification SÉPARÉ de celui des tenants :
 *   - Cookie: academia_admin_session (httpOnly, secure, sameSite=strict)
 *   - Vérification: signature HMAC + expiration + whitelist ADMIN_EMAILS
 *   - Rôle: PLATFORM_SUPER_ADMIN (distinct de PLATFORM_OWNER du tenant)
 *
 * En Edge runtime (middleware), on ne peut pas recalculer le HMAC (pas de
 * module crypto dans l'Edge runtime). On fait donc une vérification basique
 * de structure + expiration. La vérification cryptographique complète se fait
 * côté Server Component (layout admin) et API route.
 */
function getAdminFromCookie(request: NextRequest): {
  id: string;
  email: string;
  role: string;
} | null {
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(cookie)) as {
      user?: { id?: string; email?: string; role?: string };
      expiresAt?: string;
      signature?: string;
    };
    if (!decoded.user?.id || !decoded.user?.email || !decoded.signature) return null;
    if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) return null;
    return {
      id: decoded.user.id,
      email: decoded.user.email,
      role: decoded.user.role || 'PLATFORM_SUPER_ADMIN',
    };
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
  '/sign/contract', // Signature électronique de contrat par lien magique (token)
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

// Routes admin-login (ne nécessitent pas de subdomain)
// L'ancien /admin a été supprimé — le backoffice est maintenant /platform/*
const adminRoutes: string[] = [];

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
  // Définir le cookie sur le domaine parent pour qu'il persiste
  // across subdomains (évite les boucles quand la redirection change de domaine)
  const host = request.headers.get('host') || '';
  const domainMatch = host.match(/\.[^.]+\.[^.]+$/); // .academiahelm.com
  redirectResponse.cookies.set('x-redirect-depth', String(nextDepth), {
    path: '/',
    maxAge: 30, // 30 secondes — expire rapidement si pas de boucle
    sameSite: 'lax',
    ...(domainMatch ? { domain: domainMatch[0] } : {}),
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
    //
    // SYSTÈME D'AUTHENTIFICATION SÉPARÉ :
    // Le back-office utilise son propre cookie `academia_admin_session` (distinct
    // du cookie `academia_session` des tenants). La page de login dédiée est
    // /admin-login (Google OAuth + 2FA OTP email).
    //
    // En l'absence de session admin valide, on redirige vers /admin-login
    // (SUR admin.academiahelm.com — pas sur le domaine principal — pour
    // préserver le contexte sous-domaine et éviter les boucles).
    if (hostParts[0] === 'admin') {
      // Lecture du cookie admin dédié
      const admin = getAdminFromCookie(request);

      // ─── Séparation stricte des routes d'auth sur admin.academiahelm.com ───
      // Le back-office admin.academiahelm.com a ses PROPRES routes d'auth :
      //   - /admin-login (page de connexion admin)
      //   - /api/admin-auth/* (login, logout, OTP, Google OAuth)
      //
      // Les routes /login (portail école) sont BLOQUÉES sur admin.academiahelm.com
      // pour éviter la confusion entre les deux systèmes d'authentification.
      // Si un user tente /login sur admin → redirigé vers /admin-login.
      const isRegularLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
      if (isRegularLoginRoute) {
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const adminHost = hostParts.join('.');
        const loginUrl = new URL('/admin-login', `${protocol}://${adminHost}`);
        if (pathname !== '/login') {
          // Préserver les query params (ex: redirect=...)
          loginUrl.search = request.nextUrl.search;
        }
        return safeRedirect(loginUrl, request, redirectDepth);
      }

      // Routes toujours accessibles même sans auth admin : /admin-login, assets, API.
      const isAdminLoginRoute = pathname === '/admin-login' || pathname.startsWith('/admin-login/');
      const isPublicAsset =
        pathname.startsWith('/images/') ||
        pathname.startsWith('/fonts/') ||
        pathname.startsWith('/uploads/') ||
        pathname === '/sw.js' ||
        pathname === '/manifest.json' ||
        pathname === '/robots.txt' ||
        pathname === '/favicon.ico';

      if (isAdminLoginRoute || isPublicAsset || pathname.startsWith('/api/')) {
        const adminResponse = withAntiCacheHeaders(NextResponse.next());
        adminResponse.headers.set('x-admin-subdomain', 'true');
        if (admin) {
          adminResponse.headers.set('x-admin-id', admin.id);
          adminResponse.headers.set('x-admin-email', admin.email);
          adminResponse.headers.set('x-admin-role', admin.role);
        }
        return adminResponse;
      }

      if (!admin) {
        // Pas de session admin → rediriger vers /admin-login SUR LE SOUS-DOMAINE.
        // On préserve le pathname d'origine dans ?redirect= pour y revenir après login.
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const adminHost = hostParts.join('.');
        const loginUrl = new URL('/admin-login', `${protocol}://${adminHost}`);
        loginUrl.searchParams.set('redirect', pathname);
        return safeRedirect(loginUrl, request, redirectDepth);
      }

      // Admin authentifié → laisser passer
      // SAUF si on est sur la racine / → rediriger vers /platform (dashboard backoffice)
      if (pathname === '/') {
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const adminHost = hostParts.join('.');
        const adminUrl = new URL('/platform', `${protocol}://${adminHost}`);
        return safeRedirect(adminUrl, request, redirectDepth);
      }

      const adminResponse = withAntiCacheHeaders(NextResponse.next());
      adminResponse.headers.set('x-admin-subdomain', 'true');
      adminResponse.headers.set('x-admin-id', admin.id);
      adminResponse.headers.set('x-admin-email', admin.email);
      adminResponse.headers.set('x-admin-role', admin.role);
      return adminResponse;
    }

    const mainDomain = hostParts.slice(1).join('.');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const redirectUrl = new URL(pathname + request.nextUrl.search, `${protocol}://${mainDomain}`);
    return safeRedirect(redirectUrl, request, redirectDepth);
  }

  // ── Bloquer l'accès aux routes /platform/* hors du sous-domaine admin ──
  // Le back-office centralisé d'Academia Helm ne doit être accessible QUE via
  // admin.academiahelm.com. Toute tentative d'accès depuis un autre sous-domaine
  // ou le domaine principal est redirigée vers admin.academiahelm.com.
  if (pathname.startsWith('/platform')) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const mainDomain = hostParts.length >= 2 ? hostParts.slice(1).join('.') : 'academiahelm.com';
    // Convertir /platform/xxx → /platform/xxx (déjà bon)
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

  // ─── Séparation stricte : /admin-login RÉSERVÉ au sous-domaine admin ───
  // Si un user tente /admin-login sur le domaine principal ou un sous-domaine
  // d'école, on le redirige vers admin.academiahelm.com/admin-login.
  // (Inverse de la règle /login ci-dessus qui est bloquée sur admin.)
  if (pathname === '/admin-login' || pathname.startsWith('/admin-login')) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const mainDomain = hostParts.length >= 2 ? hostParts.slice(1).join('.') : 'academiahelm.com';
    const adminUrl = new URL(pathname + request.nextUrl.search, `${protocol}://admin.${mainDomain}`);
    return safeRedirect(adminUrl, request, redirectDepth);
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
    if (subdomain && !pathname.startsWith('/app')) {
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
        // MODE RÉSILIENT : si le tenant n'est pas trouvé, NE PAS rediriger
        // vers /tenant-not-found (cela cause des boucles de redirection quand
        // l'API est down). À la place, laisser passer la requête avec un
        // header d'avertissement. La page rendra et les composants géreront
        // l'erreur gracieusement.
        console.warn('TENANT_RESOLUTION_FAILED (non-blocking)', {
          tenantIdentifier,
          endpoint: pathname,
          reason: 'Tenant not found — allowing request without tenant context',
        });
        const fallbackResponse = withAntiCacheHeaders(NextResponse.next());
        if (user) {
          fallbackResponse.headers.set('X-User-ID', user.id);
        }
        return fallbackResponse;
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

      // Cache the resolved tenant info in cookies for future requests (2 hours)
      // Étendu de 30min à 2h pour réduire les appels API et éviter les boucles
      // de redirection quand l'API est temporairement down.
      const maxAge = 2 * 60 * 60; // 2 hours
      tenantResponse.cookies.set('x-resolved-tenant-id', tenant.id, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-slug', tenant.slug, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-subdomain', tenantIdentifier, { path: '/', maxAge, sameSite: 'lax' });

      return tenantResponse;
    } catch (error) {
      // MODE RÉSILIENT : si l'API est down (Fly.io OOM, réseau, etc.),
      // NE PAS rediriger vers /tenant-not-found. Cela cause des boucles de
      // redirection infinies. À la place, laisser passer la requête —
      // la page rendra et les composants géreront l'erreur d'API gracieusement.
      console.error('Error resolving tenant in middleware (non-blocking):', error);
      const fallbackResponse = withAntiCacheHeaders(NextResponse.next());
      if (user) {
        fallbackResponse.headers.set('X-User-ID', user.id);
      }
      return fallbackResponse;
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
