/**
 * Dashboard Federis
 * 
 * Cockpit institutionnel avec KPI et ORION
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import FederisLayout from '@/components/federis/FederisLayout';
import FederisDashboard from '@/components/federis/FederisDashboard';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Tableau de bord - Federis & Examens',
  description: 'Cockpit institutionnel pour la gestion des examens nationaux',
};

export default async function FederisDashboardPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/federis/login');
  }

  const user = session.user as User;
  
  // Vérifier que l'utilisateur a accès au module Federis
  // TODO: Vérifier le rôle et le tenant.type = 'PATRONAT'
  
  // TODO: Charger le tenant Federis depuis la DB
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

  // TODO: Charger l'année scolaire active
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
      <FederisDashboard tenantId={federis.id} />
    </FederisLayout>
  );
}

