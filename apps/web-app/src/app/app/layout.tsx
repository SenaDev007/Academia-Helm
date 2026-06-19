/**
 * ============================================================================
 * APP LAYOUT - LAYOUT PRINCIPAL DE L'APPLICATION
 * ============================================================================
 * 
 * Layout pour toutes les pages de l'application authentifiée
 * Utilise PilotageLayout pour la structure complète
 * 
 * Accepte 2 types d'authentification :
 *   1. Session tenant standard (cookie `academia_session`) — staff/teacher/parent
 *   2. Session admin plateforme (cookie `academia_admin_session`) — pour le
 *      back-office /app/platform sur admin.academiahelm.com
 * 
 * Si l'utilisateur est un admin plateforme, on construit une session
 * "virtuelle" avec un tenant placeholder pour permettre l'accès au back-office
 * sans nécessiter de contexte tenant (l'admin voit TOUS les tenants).
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth/session';
import { getAdminServerSession } from '@/lib/admin/admin-auth-server';
import { isReservedSubdomain } from '@/lib/tenant/constants';
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

  // ─── Authentification admin plateforme (cookie academia_admin_session) ───
  // Si l'utilisateur n'a pas de session tenant mais a une session admin valide,
  // on l'autorise à accéder au back-office /app/platform.
  // Cela évite la redirection vers /login (portail école) qui se produisait
  // quand un admin se connectait sur admin.academiahelm.com/admin-login.
  if (!session?.user) {
    const adminSession = await getAdminServerSession();
    if (adminSession) {
      // Construire un user + tenant "virtuels" pour le back-office plateforme
      const adminUser: User = {
        id: adminSession.id,
        email: adminSession.email,
        firstName: adminSession.name,
        lastName: '',
        role: 'PLATFORM_SUPER_ADMIN',
        isPlatformOwner: true,
        tenantId: '',
        // @ts-expect-error — champs optionnels selon le type User
        adminRole: adminSession.role,
      } as User;

      const platformTenant: Tenant = {
        id: 'platform',
        name: 'Academia Helm Platform',
        slug: 'platform',
        subdomain: 'admin',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trialEndsAt: undefined,
        nextPaymentDueAt: undefined,
      } as Tenant;

      return (
        <ModalProvider>
          <AppLayoutClient user={adminUser} tenant={platformTenant}>
            <PilotageLayout user={adminUser} tenant={platformTenant}>
              {children}
            </PilotageLayout>
          </AppLayoutClient>
        </ModalProvider>
      );
    }

    // Ni session tenant ni session admin → rediriger vers /login
    // Sur un sous-domaine, rediriger vers /login sur le même sous-domaine
    // (le middleware autorise /login avec session pour éviter les boucles).
    // Sur le domaine principal, rediriger vers /login normalement.
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');
    const hasSubdomain = parts.length >= 3 && !isReservedSubdomain(parts[0]);
    
    if (hasSubdomain) {
      // Sur admin.academiahelm.com, rediriger vers /admin-login (pas /login)
      // car l'utilisateur tente d'accéder au back-office plateforme.
      if (parts[0] === 'admin') {
        const protocol = headersList.get('x-forwarded-proto') || 'https';
        redirect(`${protocol}://${host}/admin-login`);
      }
      // Construire l'URL de login sur le même sous-domaine
      const protocol = headersList.get('x-forwarded-proto') || 'https';
      redirect(`${protocol}://${host}/login`);
    }
    redirect('/login');
  }

  const user = session.user as User;
  
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
