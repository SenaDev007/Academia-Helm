/**
 * Page Centres et salles — Academia Federis
 *
 * Workflow logistique (§9) : centres d'accueil par examen + salles avec
 * capacités. Réservé au coordonnateur / organisateur pour les écritures.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisCentersPage from '@/components/federis/FederisCentersPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Centres et salles - Academia Federis',
};

export default async function CentersPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/centers`);

  const user = session.user as User;
  const federis: Tenant = {
    id: user.tenantId || '',
    name: 'Espace Patronat',
    slug: 'federis',
    subdomain: '',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  } as unknown as Tenant;

  return (
    <FederisLayout user={user} federis={federis}>
      <FederisCentersPage tenantId={federis.id} userRole={user.role} />
    </FederisLayout>
  );
}
