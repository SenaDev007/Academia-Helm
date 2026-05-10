/**
 * Page Écoles - Patronat
 * 
 * Liste des écoles rattachées au patronat
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PatronatLayout from '@/components/patronat/PatronatLayout';
import PatronatSchoolsPage from '@/components/patronat/PatronatSchoolsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Écoles - Patronat & Examens',
  description: 'Gestion des écoles rattachées au patronat',
};

export default async function SchoolsPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/patronat/login');
  }

  const user = session.user as User;
  const patronat: Tenant = {
    id: user.tenantId || '',
    name: 'Patronat des Écoles Privées',
    subdomain: '',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  };

  const currentAcademicYear = {
    id: 'current-year-id',
    label: '2024-2025',
  };

  return (
    <PatronatLayout
      user={user}
      patronat={patronat}
      currentAcademicYear={currentAcademicYear}
    >
      <PatronatSchoolsPage tenantId={patronat.id} />
    </PatronatLayout>
  );
}

