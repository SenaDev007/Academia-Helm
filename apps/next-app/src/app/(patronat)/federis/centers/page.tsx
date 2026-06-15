/**
 * Page Centres - Federis
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import FederisLayout from '@/components/federis/FederisLayout';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Centres d\'examen - Federis',
};

export default async function CentersPage() {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Centres d'examen</h1>
          <p className="text-gray-600 mt-1">Gérez les centres d'examen</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Page en cours de développement
        </div>
      </div>
    </FederisLayout>
  );
}

