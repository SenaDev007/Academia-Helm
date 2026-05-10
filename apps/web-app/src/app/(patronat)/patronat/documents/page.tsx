/**
 * Page Documents - Patronat
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PatronatLayout from '@/components/patronat/PatronatLayout';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Documents - Patronat',
};

export default async function DocumentsPage() {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">Listes, relevés, attestations</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Page en cours de développement
        </div>
      </div>
    </PatronatLayout>
  );
}

