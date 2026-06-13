/**
 * ============================================================================
 * APP LAYOUT - LAYOUT PRINCIPAL DE L'APPLICATION
 * ============================================================================
 * 
 * Layout pour toutes les pages de l'application authentifiée
 * Utilise PilotageLayout pour la structure complète
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth/session';
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

  if (!session?.user) {
    // Sur un sous-domaine, rediriger vers /login sur le même sous-domaine
    // (le middleware autorise /login avec session pour éviter les boucles).
    // Sur le domaine principal, rediriger vers /login normalement.
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split('.');
    const hasSubdomain = parts.length >= 3 && !isReservedSubdomain(parts[0]);
    
    if (hasSubdomain) {
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
