/**
 * Page QHSE Dashboard
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PilotageLayout from '@/components/pilotage/PilotageLayout';
import QhsDashboard from '@/components/pilotage/dashboards/QhsDashboard';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'QHSE+ - Gouvernance & Conformité',
  description: 'Dashboard QHSE+ pour la gestion des incidents, risques et audits',
};

export default async function QhsPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;
  const tenantId = user.tenantId || '';

  // Utiliser le tenant depuis la session (chargé depuis la DB lors du login)
  // Fallback vers valeurs par défaut si le tenant n'est pas dans la session
  const tenant: Tenant = session.tenant || {
    id: tenantId,
    name: 'École Test',
    slug: '',
    subdomain: '',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  };

  return (
    <PilotageLayout user={user} tenant={tenant}>
      <QhsDashboard tenantId={tenantId} />
    </PilotageLayout>
  );
}

