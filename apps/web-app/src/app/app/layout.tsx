/**
 * ============================================================================
 * APP LAYOUT - LAYOUT PRINCIPAL DE L'APPLICATION ÉCOLE
 * ============================================================================
 *
 * Layout pour toutes les pages de l'application école authentifiée
 * (/app/hr, /app/finance, /app/students, etc.)
 *
 * Le back-office admin /platform est SÉPARÉ et a son propre layout
 * (voir /platform/layout.tsx). Ce layout ne gère QUE les sessions
 * tenant (cookie academia_session).
 *
 * Si pas de session tenant → redirect vers /login (portail école)
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth/session';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { getEffectivePortal } from '@/lib/auth/role-portal-map';
import { ModalProvider } from '@/components/modules/blueprint/modals/ModalProvider';
import AppLayoutClient from './layout-client';
import type { User, Tenant } from '@/types';

// ✅ Lazy load du layout lourd pour améliorer le temps de chargement initial
const PilotageLayout = dynamic(
  () => import('@/components/pilotage/PilotageLayout'),
  {
    ssr: true, // ✅ Garder SSR pour le SEO
  }
);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    // Pas de session tenant → rediriger vers /login (portail école)
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');
    const hasSubdomain = parts.length >= 3 && !isReservedSubdomain(parts[0]);

    if (hasSubdomain) {
      // Sur admin.academiahelm.com, rediriger vers /admin-login (pas /login)
      if (parts[0] === 'admin') {
        const protocol = headersList.get('x-forwarded-proto') || 'https';
        redirect(`${protocol}://${host}/admin-login`);
      }
      const protocol = headersList.get('x-forwarded-proto') || 'https';
      redirect(`${protocol}://${host}/login`);
    }
    redirect('/login');
  }

  const user = session.user as User;

  // ⭐ Rediriger les enseignants et parents vers leurs portails dédiés
  // AVANT de rendre le PilotageLayout (qui contient la sidebar école).
  //
  // ⚠️ IMPORTANT : on utilise `getEffectivePortal()` qui fait gagner le portail
  // CHOISI à la connexion (session.portalType / user.portal) sur le rôle DB.
  // Cela permet à un enseignant qui est aussi parent d'élève de se connecter
  // via le portail PARENT et d'atterrir sur /app/parent, même si son user.role
  // en DB est 'TEACHER'.
  const teacherRoles = ['teacher', 'TEACHER', 'TEACHER_RESP', 'ENSEIGNANT'];
  const parentRoles = ['PARENT', 'STUDENT', 'PARENT_PRIMARY', 'LEGAL_GUARDIAN', 'FINANCIAL_RESPONSIBLE'];
  const isTeacherOrParent = teacherRoles.includes(user.role) || parentRoles.includes(user.role);

  // Pour les routes /app/teacher et /app/parent, on rend directement
  // les children SANS le PilotageLayout (ils ont leur propre layout).
  // ⭐ FIX : utiliser le pathname de l'URL courante au lieu des headers
  //    qui peuvent être vides ou peu fiables → causait une boucle de redirection
  const allHeaders = await headers();
  const reqUrl = allHeaders.get('x-path') || allHeaders.get('x-forwarded-uri') || '';
  // ⭐ Fallback : utiliser nextUrl.pathname (fiable côté serveur Next.js)
  const pathname = (allHeaders.get('x-invoke-path') || reqUrl || '').toString();
  const isOnDedicatedPortal = pathname.includes('/app/teacher') || pathname.includes('/app/parent') ||
    reqUrl.includes('/app/teacher') || reqUrl.includes('/app/parent');

  if (isTeacherOrParent && !isOnDedicatedPortal) {
    // ⭐ Résoudre le portail effectif : portalType de session > user.portal > role-based fallback
    const effectivePortal = getEffectivePortal(
      user.role,
      (session as any)?.portalType || (user as any)?.portal,
    );

    if (effectivePortal === 'PARENT') {
      redirect('/app/parent');
    } else if (effectivePortal === 'TEACHER') {
      redirect('/app/teacher');
    }
    // Si effectivePortal est SCHOOL/PLATFORM/PUBLIC → on rend le PilotageLayout
    // (cas normal pour un admin/directeur qui se connecte via portail école).
  }

  // ⭐ Pour les routes /app/teacher et /app/parent, on rend directement
  // les children SANS le PilotageLayout.
  if (isOnDedicatedPortal) {
    // Tenant info still needed for context
    const sessionTenant2 = session.tenant;
    const tenantIdFromUser2 = (user as any).tenantId || '';
    const effectiveTenantId2 = sessionTenant2?.id || tenantIdFromUser2;
    const tenant2: Tenant = sessionTenant2 && effectiveTenantId2
      ? { ...sessionTenant2, id: sessionTenant2.id || effectiveTenantId2 }
      : {
          id: effectiveTenantId2,
          name: effectiveTenantId2 ? 'Mon École' : '',
          slug: sessionTenant2?.slug ?? '',
          subdomain: sessionTenant2?.subdomain ?? '',
          status: 'active',
          subscriptionStatus: 'ACTIVE_SUBSCRIBED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          trialEndsAt: undefined,
          nextPaymentDueAt: undefined,
        } as Tenant as Tenant;

    return (
      <ModalProvider>
        <AppLayoutClient user={user} tenant={tenant2}>
          {children}
        </AppLayoutClient>
      </ModalProvider>
    );
  }
  
  // Tenant : session.tenant prioritaire ; si id manquant, utiliser user.tenantId (connexion avec école en mode dev)
  const sessionTenant = session.tenant;
  const tenantIdFromUser = (user as any).tenantId || '';
  const effectiveTenantId = sessionTenant?.id || tenantIdFromUser;
  const tenant: Tenant = sessionTenant && effectiveTenantId
    ? { ...sessionTenant, id: sessionTenant.id || effectiveTenantId }
    : {
        id: effectiveTenantId,
        name: effectiveTenantId ? 'Mon École' : '',
        slug: sessionTenant?.slug ?? '',
        subdomain: sessionTenant?.subdomain ?? '',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trialEndsAt: undefined,
        nextPaymentDueAt: undefined,
      } as Tenant as Tenant;

  return (
    <ModalProvider>
      <AppLayoutClient user={user} tenant={tenant}>
        <PilotageLayout user={user} tenant={tenant}>
          {children}
        </PilotageLayout>
      </AppLayoutClient>
    </ModalProvider>
  );
}
