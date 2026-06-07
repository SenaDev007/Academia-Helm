/**
 * Page Écoles - Federis
 * 
 * Liste des écoles rattachées au federis
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisSchoolsPage from '@/components/federis/FederisSchoolsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Écoles - Federis & Examens',
  description: 'Gestion des écoles rattachées au federis',
};

export default async function SchoolsPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/federis/login');
  }

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

  const currentAcademicYear = {
    id: 'current-year-id',
    label: '2024-2025',
  };

  return (
    <FederisLayout
      user={user}
      federis={federis}
      currentAcademicYear={currentAcademicYear}
    >
      <FederisSchoolsPage tenantId={federis.id} />
    </FederisLayout>
  );
}

