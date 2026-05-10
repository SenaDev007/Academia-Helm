/**
 * Page ORION - Patronat
 * 
 * Analyse institutionnelle et alertes
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PatronatLayout from '@/components/patronat/PatronatLayout';
import PatronatOrionPage from '@/components/patronat/PatronatOrionPage';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'ORION - Analyse Institutionnelle',
};

export default async function OrionPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/patronat/login');

  const user = session.user as User;
  const patronat: Tenant = {
    id: user.tenantId || '',
    name: 'Patronat des Écoles Privées',
    slug: 'patronat',
    subdomain: '',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  } as Tenant as Tenant;

  return (
    <PatronatLayout
      user={user}
      patronat={patronat}
      currentAcademicYear={{ id: 'current', label: '2024-2025' }}
    >
      <PatronatOrionPage tenantId={patronat.id} />
    </PatronatLayout>
  );
}

