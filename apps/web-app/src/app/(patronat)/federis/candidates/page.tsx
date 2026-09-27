/**
 * Page Candidats — Academia Federis
 *
 * Fichier national des candidats (§8.4) : registre par examen, import Excel
 * par lot (analyse SheetJS côté client puis POST JSON), affectation automatique
 * des numéros de table (centres → salles → numérotation séquentielle).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisCandidatesPage from '@/components/federis/FederisCandidatesPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Candidats - Academia Federis',
};

export default async function CandidatesPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/candidates`);

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
      <FederisCandidatesPage tenantId={federis.id} userRole={user.role} />
    </FederisLayout>
  );
}
