/**
 * Page Examens - Patronat
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PatronatLayout from '@/components/patronat/PatronatLayout';
import PatronatExamsPage from '@/components/patronat/PatronatExamsPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Examens - Patronat & Examens',
};

export default async function ExamsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/patronat/login');

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

  return (
    <PatronatLayout
      user={user}
      patronat={patronat}
      currentAcademicYear={{ id: 'current', label: '2024-2025' }}
    >
      <PatronatExamsPage tenantId={patronat.id} />
    </PatronatLayout>
  );
}

