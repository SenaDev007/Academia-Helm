/**
 * Page Matières — Academia Federis
 *
 * Catalogue des matières d'examen par type (CEP / BEPC / BAC / CAP) et par
 * série (BAC) — reproduction du CRUD du module Pédagogie Helm, contextualisée
 * aux examens nationaux. Alimente le lancement des campagnes, le module
 * Épreuves (signal « épreuves à préparer ») et le module Notes et Moyennes.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisSubjectsPage from '@/components/federis/FederisSubjectsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Matières - Academia Federis',
};

export default async function SubjectsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/subjects`);

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
      <FederisSubjectsPage tenantId={federis.id} userRole={user.role} />
    </FederisLayout>
  );
}
