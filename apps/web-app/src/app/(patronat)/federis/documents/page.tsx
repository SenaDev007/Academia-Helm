/**
 * Page Documents - Federis
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import FederisLayout from '@/components/federis/FederisLayout';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Documents - Federis',
};

export default async function DocumentsPage() {
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
          <div className="fed-badge mb-3">Module ressources</div>
          <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">Documents</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Listes, relevés, attestations</p>
        </div>
        <div className="fed-card p-12 text-center text-slate-500">
          Page en cours de développement
        </div>
      </div>
    </FederisLayout>
  );
}

