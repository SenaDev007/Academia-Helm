/**
 * Page Notes et Moyennes — Academia Federis
 *
 * Reproduction du module Examen d'Academia Helm pour les examens nationaux :
 * sélection du type (CEP / BEPC / BAC / CAP) → saisie des notes (primaire
 * sans coefficients pour le CEP, secondaire avec coefficients pour le
 * BEPC/BAC/CAP), registre des notes et relevés de notes (PDF backend).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisGradesPage from '@/components/federis/FederisGradesPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Notes et Moyennes - Academia Federis',
};

export default async function GradesPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/grades`);

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
      <FederisGradesPage tenantId={federis.id} userRole={user.role} />
    </FederisLayout>
  );
}
