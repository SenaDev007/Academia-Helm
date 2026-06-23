/**
 * ============================================================================
 * PLATFORM LAYOUT — Layout racine du back-office /platform
 * ============================================================================
 *
 * CE LAYOUT est complètement SÉPARÉ de /app/layout.tsx (qui gère l'app école
 * avec session tenant). Le back-office /platform est RÉSERVÉ aux admins
 * plateforme authentifiés via /admin-login (cookie academia_admin_session).
 *
 * Il ne doit JAMAIS :
 *   - Rediriger vers /login (portail école)
 *   - Exiger une session tenant (cookie academia_session)
 *   - Afficher le PilotageLayout avec les modules école
 *
 * Si l'utilisateur n'a pas de session admin valide → redirect vers /admin-login
 * ============================================================================
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminServerSession } from '@/lib/admin/admin-auth-server';
import type { User, Tenant } from '@/types';
import PlatformAdminLayoutClient from './admin-layout-client';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Vérifier la session admin (cookie academia_admin_session)
  const adminSession = await getAdminServerSession();

  if (!adminSession) {
    // Pas de session admin → rediriger vers /admin-login
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'https';

    if (host.startsWith('admin.')) {
      redirect(`${protocol}://${host}/admin-login?redirect=/platform`);
    }
    redirect(`${protocol}://admin.academiahelm.com/admin-login?redirect=/platform`);
  }

  // Session admin valide → construire user + tenant virtuels
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
    <PlatformAdminLayoutClient user={adminUser} tenant={platformTenant}>
      {children}
    </PlatformAdminLayoutClient>
  );
}
