/**
 * Page Saisie des notes (secrétaires) — Academia Federis
 *
 * ⭐ 2026-10-01 — Interface dédiée des enseignants affectés au poste de
 * SECRÉTARIAT (compte provisoire PATRONAT_SAISIE_NOTES, créé automatiquement
 * à l'affectation dans le module Centres, salles & Surveillants) : l'enseignant
 * y voit son poste, l'examen (CEP/BEPC/BAC/CAP + session + année scolaire), le
 * centre et la salle attribués, puis saisit les notes des candidats de son
 * périmètre. La RÈGLE ÉPREUVE PRÉPARÉE verrouille les matières sans épreuve.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisSaisiePage from '@/components/federis/FederisSaisiePage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Saisie des notes - Academia Federis',
};

export default async function SaisiePage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/saisie`);

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
      <FederisSaisiePage userRole={user.role} />
    </FederisLayout>
  );
}
