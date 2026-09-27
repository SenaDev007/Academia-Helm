/**
 * Page Écoles rattachées — demande de rattachement Helm + écoles manuelles (§8.3)
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession, getServerToken } from '@/lib/auth';
import { loadFederisProfile } from '@/lib/federis/server-api';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisSchoolsPage from '@/components/federis/FederisSchoolsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Écoles rattachées - Academia Federis',
};

export default async function SchoolsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect(`${getFederisBasePath()}/login?redirect=/federis/schools`);

  const user = session.user as User;
  const token = await getServerToken();
  const profile = await loadFederisProfile(token);

  const federis: Tenant = {
    id: profile?.tenantId || user.tenantId || '',
    name: profile?.name ?? 'Espace Patronat',
    slug: 'federis',
    subdomain: '',
    status: 'active',
    subscriptionStatus: profile?.subscription?.status ?? 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: profile?.subscription?.expiresAt ?? undefined,
  } as Tenant;

  return (
    <FederisLayout user={user} federis={federis} currentAcademicYear={undefined}>
      <FederisSchoolsPage />
    </FederisLayout>
  );
}
