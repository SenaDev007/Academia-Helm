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

  if (process.env.NODE_ENV === 'development') {
    const devSubdomain = request.headers.get('x-tenant-subdomain');
    if (devSubdomain) return devSubdomain;
  }

  const parts = host.split('.');

  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'localhost') {
    return parts[0];
  }

  return null;
}

async function resolveTenant(subdomain: string): Promise<{ id: string; slug: string; status: string; subscriptionStatus?: SubscriptionStatus } | null> {
  try {
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

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
    console.error('Error resolving tenant in middleware:', error);
    return null;
  }
}

const publicRoutes = [
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
];

// Routes admin (ne nécessitent pas de subdomain)
const adminRoutes = [
  '/admin',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomainFromRequest(request);

  // Routes Patronat : utiliser le middleware dédié
  if (pathname.startsWith('/patronat')) {
    const { patronatMiddleware } = await import('./middleware-patronat');
    return patronatMiddleware(request);
  }

  const response = NextResponse.next();
  const user = getUserFromSessionCookie(request);

  // Routes admin : pas de vérification de subdomain
  if (pathname.startsWith('/admin')) {
    // La vérification du rôle SUPER_ADMIN se fait dans le layout
    // Ajouter le pathname dans les headers pour le layout
    const adminResponse = NextResponse.next();
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

  // Route racine `/` toujours accessible, même avec subdomain (landing page principale)
  if (pathname === '/') {
    return response;
  }

  // Routes publiques
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    
    if (!subdomain) {
      return response;
    }

    if (subdomain && !pathname.startsWith('/app') && !pathname.startsWith('/admin')) {
      const mainDomain = getAppBaseUrl();
      return NextResponse.redirect(new URL(pathname, mainDomain));
    }
  }

  // Routes app (nécessitent un subdomain ou tenant_id)
  if (pathname.startsWith('/app')) {
    // En local, vérifier le paramètre tenant dans l'URL
    const isLocal = process.env.NODE_ENV === 'development';
    const tenantParam = request.nextUrl.searchParams.get('tenant');
    
    // Si pas de subdomain ET pas de tenant param → vérifier la session
    if (!subdomain && !tenantParam) {
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
            ipAddress: request.ip || request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => {}); // Ne pas bloquer sur erreur de logging
      } catch {}
      
      return NextResponse.redirect(new URL('/portal', mainDomain));
    }

    // Résoudre le tenant (subdomain ou param)
    const tenantIdentifier = subdomain || tenantParam;
    
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
              ipAddress: request.ip || request.headers.get('x-forwarded-for'),
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
      const tenantResponse = NextResponse.next();
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
            ipAddress: request.ip || request.headers.get('x-forwarded-for'),
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
    '/((?!api|_next/static|_next/image|favicon.ico|images/|fonts/|uploads/|sw.js|manifest.json|robots.txt|sitemap.xml).*)',
  ],
};
