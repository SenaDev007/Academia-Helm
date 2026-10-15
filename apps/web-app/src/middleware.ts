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

/** ⭐ Dossiers statiques PUBLICS (fichiers servis depuis /public) : ils ne
 *  doivent JAMAIS être réécrits par les satellites (academiafederis…), les
 *  sous-domaines patronat (patronatXXX…) ou saisiemaster — sinon
 *  /pedagogy-assets/anatomie/cerveau.svg devient /federis/pedagogy-assets/…
 *  (route inexistante → 404 → images de la bibliothèque de l'éditeur
 *  enrichi CASSÉES dans les épreuves du patronat — bug 2026-09-30).
 *  Ces préfixes sont AUSSI exclus du matcher (config.config) — cette liste
 *  sert de garde-fou pour les branches de rewrite ci-dessous. */
const PUBLIC_STATIC_PREFIXES = [
  '/images/',
  '/fonts/',
  '/uploads/',
  '/videos/',
  '/sounds/',
  '/logos/',
  '/icons/',
  '/legal/',
  '/orion-rules/',
  '/pedagogy-assets/',
  '/pedagogy-images/',
  // ⭐ T57 (2026-10-01) — lib Partytown auto-hébergée (scripts tiers en Web
  //    Worker) : le bootstrap + son Service Worker /~partytown/* doivent
  //    être servis tels quels sur TOUS les domaines (patronatXXX compris),
  //    sinon le rewrite satellite les transforme en /federis/~partytown/…
  //    → 404 → erreur console « Failed to register a ServiceWorker » à
  //    chaque chargement de page + GA (partytown) jamais exécuté.
  '/~partytown/',
];

/** Le pathname vise-t-il un fichier statique public (jamais réécrit) ? */
function isPublicStaticAsset(pathname: string): boolean {
  return PUBLIC_STATIC_PREFIXES.some((p) => pathname.startsWith(p));
}

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
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (était 3s — trop court)

    // ⭐ Essayer d'abord by-subdomain (qui accepte slug OU subdomain OU UUID)
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
      // ⭐ Fallback : si by-subdomain échoue (404), essayer by-slug
      if (response.status === 404) {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 3000);
        const fallbackResponse = await fetch(`${apiUrl}/tenants/by-slug/${subdomain}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: fallbackController.signal,
        });
        clearTimeout(fallbackTimeout);
        if (!fallbackResponse.ok) return null;
        const fallbackTenant = await fallbackResponse.json();
        if (!fallbackTenant || (fallbackTenant.subscriptionStatus === 'PENDING' || fallbackTenant.subscriptionStatus === 'TERMINATED')) {
          return null;
        }
        return fallbackTenant;
      }
      return null;
    }

    const tenant = await response.json();

    // ⭐ Accepter ACTIVE_SUBSCRIBED comme statut valide
    // (avant, on rejetait si subscriptionStatus n'était pas défini ET status !== 'active')
    // Maintenant on accepte : subscriptionStatus = ACTIVE_SUBSCRIBED OU status = 'active'
    if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
      return null;
    }
    // Accepter si subscriptionStatus est défini et actif, OU si status est active/trial
    if (!tenant.subscriptionStatus && tenant.status !== 'active' && tenant.status !== 'trial') {
      return null;
    }

    return tenant;
  } catch (error) {
    // Timeout ou erreur réseau — ne pas bloquer le rendu
    console.warn('resolveTenant error (non-blocking):', error instanceof Error ? error.message : String(error));
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
  '/reactivate', // Réactivation de compte bloqué (paiement frais)
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
  '/school-portal/jobs',
  '/public/pre-enrollment',
  '/jobs',
];

/**
 * Ajoute les headers anti-cache Cloudflare à une réponse.
 * Empêche le buffering et la mise en cache des réponses HTML,
 * ce qui est essentiel pour le streaming Next.js / Suspense (loading.tsx).
 */
function withAntiCacheHeaders(response: NextResponse, pathname?: string): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Accel-Buffering', 'no'); // Empêche le buffering par reverse-proxy (nginx/Cloudflare)
  // ⭐ Transmettre le pathname aux layouts SSR (fiable, jamais vide)
  if (pathname) {
    response.headers.set('x-path', pathname);
  }
  return response;
}

/**
 * Supprime le cookie `x-redirect-depth` d'une réponse non-redirect.
 *
 * Pourquoi : le middleware compte les redirections successives via ce cookie
 * (maxAge=30s). Quand on renvoie une réponse "normale" (NextResponse.next()
 * ou rewrite), il faut ABSOLUMENT supprimer ce cookie, sinon il persiste à
 * travers les navigations intra-app et finit par atteindre le seuil
 * MAX_REDIRECT_DEPTH (=5) → page d'erreur "Trop de redirections".
 *
 * Scénario typique : l'utilisateur navigue dans le module RH (Préparer contrat,
 * Retour, etc.). Chaque navigation sans ?tenant= dans l'URL déclenche un
 * redirect pour ajouter le tenant, incrémentant le cookie. Sans suppression
 * sur les réponses normales, le compteur ne redescend jamais entre deux
 * redirects, et au bout de 5 navigations rapides, on tombe sur l'erreur.
 *
 * IMPORTANT : on doit spécifier le même `domain` que celui utilisé pour SET
 * le cookie (cf. safeRedirect), sinon le navigateur ne le supprimera pas.
 * Ici, on essaie les deux : sans domaine (par défaut) ET avec le domaine
 * parent détecté depuis le host. Cela couvre tous les cas de figure.
 */
function clearRedirectDepthCookie(response: NextResponse, request: NextRequest): NextResponse {
  // ⭐ Host-only cookie (pas de `domain`) — on supprime sans domaine pour
  // matcher le cookie créé par safeRedirect (également host-only maintenant).
  response.cookies.delete('x-redirect-depth');
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
  // ⭐ Host-only cookie (pas de `domain`) — scoped au sous-domaine exact pour
  // isoler les sessions entre tenants et éviter les conflits cross-onglet.
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
      // ⭐ Fichiers statiques publics (bibliothèque d'images pédagogiques de
      //    l'éditeur, polices, médias…) : servis tels quels, JAMAIS réécrits
      //    vers /federis/* (sinon 404 → images cassées dans les épreuves).
      if (isPublicStaticAsset(pathname)) {
        return NextResponse.next();
      }
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

    // ── SaisieMaster satellite app ──
    // saisiemaster.academiahelm.com/* → /saisiemaster/*
    // Application autonome de saisie de notes au format EducMaster (Benin).
    // Layout dedie (/saisiemaster/layout.tsx) sans la navbar Academia Helm.
    // ⚠️ IMPORTANT : ne PAS rewriter les routes /api/* — elles doivent passer
    // telles quelles pour que les BFF routes (/api/saisiemaster/signup, etc.)
    // fonctionnent correctement.
    if (hostParts[0] === 'saisiemaster' && !pathname.startsWith('/api/')) {
      // ⭐ Fichiers statiques publics : jamais réécrits vers /saisiemaster/*
      if (isPublicStaticAsset(pathname)) {
        return NextResponse.next();
      }
      let saisiePath: string;
      if (pathname === '/') {
        saisiePath = '/saisiemaster';
      } else if (pathname.startsWith('/saisiemaster')) {
        // Déjà préfixé — utiliser tel quel (ex: ancien bookmark)
        saisiePath = pathname;
      } else {
        saisiePath = `/saisiemaster${pathname}`;
      }
      const rewriteUrl = new URL(saisiePath + request.nextUrl.search, request.nextUrl.origin);
      const saisieResponse = withAntiCacheHeaders(NextResponse.rewrite(rewriteUrl));
      saisieResponse.headers.set('x-saisiemaster-subdomain', 'true');
      return saisieResponse;
    }

    // ── Helm Enseignant satellite app ──
    // enseignant.academiahelm.com/* → /prof/*
    // Portail autonome des enseignants (mini-SaaS « Helm Enseignant ») :
    // landing marketing, inscription/login autonomes, espace connecté
    // (dashboard, pédagogie, travaux, examens, planification…).
    // ⭐ Le nom PUBLIC du portail est « enseignant » (décision 2026-10-16) —
    //    l'ancien libellé « prof.academiahelm.com » est redirigé ci-dessous.
    // ⚠️ IMPORTANT : ne PAS rewriter les routes /api/* — les BFF routes
    //    (/api/teacher-portal/login, /register) doivent passer telles quelles
    //    (le matcher exclut déjà /api/, ce test est un garde-fou).
    // L'authentification reste double : ce rewrite sert la page /prof/* dont
    // le layout serveur (connected) vérifie session + portalType TEACHER
    // (pattern patronat — filet de sécurité indépendant du middleware).
    if (hostParts[0] === 'enseignant' && !pathname.startsWith('/api/')) {
      // ⭐ Fichiers statiques publics : jamais réécrits vers /prof/*
      if (isPublicStaticAsset(pathname)) {
        return NextResponse.next();
      }
      // Rewrite enseignant.academiahelm.com/* → /prof/*
      //   /           → /prof (landing marketing)
      //   /login      → /prof/login
      //   /dashboard  → /prof/dashboard
      //   /prof/xxx   → /prof/xxx (déjà préfixé — liens internes du portail)
      let profPath: string;
      if (pathname === '/') {
        profPath = '/prof';
      } else if (pathname.startsWith('/prof')) {
        // Déjà préfixé — utiliser tel quel (navigation interne du portail)
        profPath = pathname;
      } else {
        profPath = `/prof${pathname}`;
      }
      const rewriteUrl = new URL(profPath + request.nextUrl.search, request.nextUrl.origin);
      // ⭐ PORTE SESSION (routes connectées) : le satellite retourne directement
      //    et court-circuite le dispatch profMiddleware normal — on applique ici
      //    la MÊME règle (session + portalType TEACHER) sur le chemin réécrit
      //    (ex. /checkout non authentifié → /prof/login?redirect=/prof/checkout,
      //    exactement comme sur le domaine principal).
      const { profSatelliteGate } = await import('./middleware-prof');
      const gate = profSatelliteGate(profPath, request);
      if (gate) return gate;
      const profSatelliteResponse = withAntiCacheHeaders(NextResponse.rewrite(rewriteUrl), profPath);
      // Header documentant le contexte satellite (pattern federis/saisiemaster)
      profSatelliteResponse.headers.set('x-enseignant-subdomain', 'true');
      return profSatelliteResponse;
    }

    // ── Alias historique : prof.academiahelm.com → enseignant.academiahelm.com ──
    // Le portail enseignant devait initialement être servi sur
    // prof.academiahelm.com ; le nom public retenu est « enseignant ».
    // Redirection permanente (301) en conservant chemin + query — couvre le
    // cas d'un utilisateur saisissant l'ancien libellé ou d'un ancien lien.
    if (hostParts[0] === 'prof') {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const enseignantHost = `enseignant.${hostParts.slice(1).join('.')}`;
      const enseignantUrl = new URL(pathname + request.nextUrl.search, `${protocol}://${enseignantHost}`);
      const aliasResponse = NextResponse.redirect(enseignantUrl, 301);
      return withAntiCacheHeaders(aliasResponse);
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
        const adminResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
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

      const adminResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
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

  // ── Sous-domaines PATRONAT (tenant PATRONAT — Academia Federis) ──
  // Convention d'attribution (à l'activation, après paiement Fedapay) :
  //   - Patronat national     → patronatnational.academiahelm.com
  //   - Patronat départemental → patronat{département}.academiahelm.com
  //     (ex : Atlantique → patronatatlantique.academiahelm.com)
  // Même mécanique de rewrite que le satellite academiafederis (l'URL reste
  // visible dans la barre d'adresse) :
  //   /           → /patronat-portal (landing page publique du patronat)
  //   /login      → /federis/login (connexion Academia Federis du patronat)
  //   /xxx        → /federis/xxx (application — dashboard, examens…)
  // Les routes /api/*, assets Next et fichiers statiques passent tels quels.
  // La page /patronat-portal résout le tenant par sous-domaine et redirige
  // vers /school-portal si le tenant n'est pas un patronat (garde-fou
  // anti-collision avec une école dont le sous-domaine commencerait par
  // « patronat »).
  if (
    hostParts.length >= 3 &&
    !isReservedSubdomain(hostParts[0]) &&
    hostParts[0].startsWith('patronat') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/')
  ) {
    let patronatTarget: string;
    if (pathname === '/') {
      patronatTarget = '/patronat-portal';
    } else if (pathname === '/login') {
      patronatTarget = '/federis/login';
    } else if (pathname.startsWith('/federis') || pathname.startsWith('/patronat')) {
      // Déjà préfixé (bookmark ancien / lien direct)
      patronatTarget = pathname;
    } else if (
      pathname.startsWith('/images/') ||
      pathname.startsWith('/fonts/') ||
      pathname.startsWith('/uploads/') ||
      isPublicStaticAsset(pathname) ||
      pathname === '/favicon.ico' ||
      pathname === '/manifest.json' ||
      pathname === '/robots.txt' ||
      pathname === '/sw.js'
    ) {
      // Assets statiques : jamais de rewrite
      patronatTarget = pathname;
    } else {
      // Application Federis : /dashboard → /federis/dashboard, /exams → /federis/exams…
      patronatTarget = `/federis${pathname}`;
    }
    const patronatUrl = new URL(patronatTarget + request.nextUrl.search, request.nextUrl.origin);
    const patronatResponse = withAntiCacheHeaders(
      NextResponse.rewrite(patronatUrl),
      patronatTarget,
    );
    // Header lisible par les pages serveur (le host d'origine est conservé
    // par le rewrite — ce header documente le contexte satellite).
    patronatResponse.headers.set('x-patronat-subdomain', hostParts[0]);
    return patronatResponse;
  }

  // Routes Patronat (Academia Federis) : utiliser le middleware dédié
  if (pathname.startsWith('/patronat') || pathname.startsWith('/federis')) {
    const { patronatMiddleware } = await import('./middleware-patronat');
    return patronatMiddleware(request);
  }

  // ⭐ Routes Helm Enseignant (mini-SaaS enseignant autonome) : middleware dédié
  if (pathname === '/prof' || pathname.startsWith('/prof/')) {
    const { profMiddleware } = await import('./middleware-prof');
    return profMiddleware(request);
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

  const response = withAntiCacheHeaders(NextResponse.next(), pathname);

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
  // Si l'utilisateur accède à school.academiahelm.com/, on REWRITE (pas redirect)
  // vers /school-portal pour afficher le site institutionnel de l'école.
  // Le rewrite se fait QUEL QUE SOIT le statut de session — même si l'utilisateur
  // a une session valide, on affiche le site institutionnel sur la racine.
  // L'accès à /app/* reste possible avec la session.
  if (pathname === '/') {
    if (subdomain) {
      const rewriteUrl = new URL('/school-portal', request.nextUrl.origin);
      return NextResponse.rewrite(rewriteUrl);
    }
    return response;
  }

  // ── Route `/jobs` avec sous-domaine d'école ──
  // /jobs → rewrite vers /school-portal/jobs (page recrutement tenant)
  // /jobs/{slug}/{jobSlug} → laisser passer vers /jobs/[schoolSlug]/[jobSlug]
  //   (page de candidature existante qui gère le flux d'onboarding)
  if (pathname === '/jobs') {
    if (subdomain) {
      const rewriteUrl = new URL('/school-portal/jobs', request.nextUrl.origin);
      return NextResponse.rewrite(rewriteUrl);
    }
    return response;
  }
  // /jobs/{slug}/{jobSlug} — ne pas rewrite, laisser la route /jobs/[schoolSlug]/[jobSlug] gérer
  if (pathname.startsWith('/jobs/')) {
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
    const tenantParam = request.nextUrl.searchParams.get('tenant');
    const tenantIdParam = request.nextUrl.searchParams.get('tenant_id');

    // Si pas de subdomain ET pas de tenant param → vérifier la session
    if (!subdomain && !tenantParam && !tenantIdParam) {
      // Si la session contient un tenant valide, LAISSER PASSER la requête
      // en injectant le tenant via les headers X-Tenant-ID / X-Tenant-Slug.
      //
      // ⚠️ Ne PAS rediriger pour ajouter ?tenant= à l'URL — c'était la cause
      // principale du bug "Trop de redirections" dans le module RH :
      // chaque navigation intra-app (ex. /app/hr/recruitment → /app/hr/contracts/<id>)
      // déclenchait un redirect pour ajouter ?tenant=, et le cookie
      // x-redirect-depth s'accumulait jusqu'à atteindre le seuil de 5.
      // Les pages RH récupèrent le tenant depuis la session (AppSessionContext),
      // pas depuis l'URL — donc le redirect était purement cosmétique.
      if (user?.tenantId) {
        const tenantResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
        tenantResponse.headers.set('X-Tenant-ID', user.tenantId);
        if (user.tenantSlug) {
          tenantResponse.headers.set('X-Tenant-Slug', user.tenantSlug);
        }
        tenantResponse.headers.set('X-User-ID', user.id);
        // Forward portal_type header for RBAC validation
        if (user.portalType) {
          tenantResponse.headers.set('X-Portal-Type', user.portalType);
        }
        return clearRedirectDepthCookie(tenantResponse, request);
      }

      // PLATFORM_OWNER sans tenantId → rediriger vers le portail pour sélectionner une école
      // Même le PLATFORM_OWNER doit toujours être dans le contexte d'un tenant (sous-domaine professionnel)
      if (user?.id && user.isPlatformOwner) {
        const mainDomain = getAppBaseUrl();
        return safeRedirect(new URL('/portal', mainDomain), request, redirectDepth);
      }

      // Pas de session du tout → rediriger vers /portal pour login
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
        const tenantResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
        tenantResponse.headers.set('X-Tenant-ID', user.tenantId);
        if (user.tenantSlug) {
          tenantResponse.headers.set('X-Tenant-Slug', user.tenantSlug);
        }
        tenantResponse.headers.set('X-User-ID', user.id);
        return clearRedirectDepthCookie(tenantResponse, request);
      }
      // Session ne correspond pas à l'URL → on continue vers resolveTenant
      // (qui re-validera le tenant demandé dans l'URL).
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
      const cachedResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
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
      return clearRedirectDepthCookie(cachedResponse, request);
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
        const fallbackResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
        if (user) {
          fallbackResponse.headers.set('X-User-ID', user.id);
        }
        return clearRedirectDepthCookie(fallbackResponse, request);
      }

      // Vérifier que le tenant est actif
      if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
        const mainDomain = getAppBaseUrl();
        return safeRedirect(new URL('/tenant-not-found', mainDomain), request, redirectDepth);
      }

      // Créer une nouvelle réponse pour ajouter les headers
      const tenantResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
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

      // Cache the resolved tenant info in cookies for future requests (7 days).
      // ⚠️ PERFORMANCE — Étendu de 2h à 7j pour réduire les appels API.
      // Raison : le tenant change TRÈS rarement en cours de session (un utilisateur
      // ne change pas d'école en cours de journée). 7j correspond à la TTL du
      // cookie de session, donc tant que l'utilisateur est connecté, le tenant
      // reste caché → plus aucun appel API /tenants/by-subdomain en middleware.
      // Économie : ~1 appel API par navigation /app/* (au premier chargement).
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      tenantResponse.cookies.set('x-resolved-tenant-id', tenant.id, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-slug', tenant.slug, { path: '/', maxAge, sameSite: 'lax' });
      tenantResponse.cookies.set('x-resolved-tenant-subdomain', tenantIdentifier, { path: '/', maxAge, sameSite: 'lax' });

      return clearRedirectDepthCookie(tenantResponse, request);
    } catch (error) {
      // MODE RÉSILIENT : si l'API est down (Fly.io OOM, réseau, etc.),
      // NE PAS rediriger vers /tenant-not-found. Cela cause des boucles de
      // redirection infinies. À la place, laisser passer la requête —
      // la page rendra et les composants géreront l'erreur d'API gracieusement.
      console.error('Error resolving tenant in middleware (non-blocking):', error);
      const fallbackResponse = withAntiCacheHeaders(NextResponse.next(), pathname);
      if (user) {
        fallbackResponse.headers.set('X-User-ID', user.id);
      }
      return clearRedirectDepthCookie(fallbackResponse, request);
    }
  }

  // Réinitialiser le compteur de redirection pour les réponses normales
  // (pas de redirection → pas de boucle possible)
  return clearRedirectDepthCookie(response, request);
}

export const config = {
  matcher: [
    // ✅ Exclut /api/* du middleware — les headers anti-cache sont maintenant
    // gérés statiquement dans next.config.js → headers() (plus efficace).
    // Cela évite à l'Edge Function de s'exécuter sur chaque requête API
    // (économise des invocations Vercel + réduit TBT de ~50ms).
    // ✅ PWA : /pwa-icon (icônes dynamiques par école, résout le tenant
    // elle-même) et les manifests dynamiques (*.webmanifest) sont exclus —
    // leurs routes gèrent leur propre contexte + Cache-Control.
    // ✅ Fichiers statiques PUBLICS (/pedagogy-assets, /pedagogy-images,
    // vidéos, sons…) : servis tels quels sur TOUS les domaines (satellites
    // academiafederis/patronatXXX compris) — sinon le rewrite satellite les
    // transforme en /federis/… → 404 → images de la bibliothèque cassées.
    '/((?!_next/static|_next/image|favicon.ico|images/|fonts/|uploads/|videos/|sounds/|logos/|icons/|legal/|orion-rules/|pedagogy-assets/|pedagogy-images/|~partytown/|sw.js|sw-site.js|sw-chat.js|manifest.json|manifest-site.webmanifest|manifest-app.webmanifest|pwa-icon|apple-touch-icon.png|robots.txt|sitemap.xml|api/).*)',
  ],
};
