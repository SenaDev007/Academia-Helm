/**
 * Page Candidats - Federis
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisCandidatesPage from '@/components/federis/FederisCandidatesPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Candidats - Federis & Examens',
};

export default async function CandidatesPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/federis/login');

  const user = session.user as User;
  const federis: Tenant = {
    id: user.tenantId || '',
    name: 'Federis des Écoles Privées',
    slug: 'federis',
    subdomain: '',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  } as Tenant as Tenant;

  return (
    <FederisLayout
      user={user}
      federis={federis}
      currentAcademicYear={{ id: 'current', label: '2024-2025' }}
    >
      <FederisCandidatesPage tenantId={federis.id} />
    </FederisLayout>
  );
}

