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
import { getServerSession } from '@/lib/auth/session';
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
      };

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
