/**
 * Page Examens nationaux — Academia Federis
 *
 * Données réelles : GET /federis/exams. Création et statut réservés au
 * coordonnateur / organisateur (garde finale côté API).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisExamsPage from '@/components/federis/FederisExamsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Examens nationaux - Academia Federis',
};

export default async function ExamsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/exams`);

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
      {/* ⭐ userRole = User.role de la session — normalisé côté composant pour
          les gardes d'écriture UI (la garde finale reste côté API) */}
      <FederisExamsPage tenantId={federis.id} userRole={user.role} />
    </FederisLayout>
  );
}
