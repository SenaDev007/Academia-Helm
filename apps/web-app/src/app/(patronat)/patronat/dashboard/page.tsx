/**
 * Dashboard Patronat
 * 
 * Cockpit institutionnel avec KPI et ORION
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import PatronatLayout from '@/components/patronat/PatronatLayout';
import PatronatDashboard from '@/components/patronat/PatronatDashboard';
import type { User, Tenant } from '@/types';

export const metadata: Metadata = {
  title: 'Tableau de bord - Patronat & Examens',
  description: 'Cockpit institutionnel pour la gestion des examens nationaux',
};

export default async function PatronatDashboardPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/patronat/login');
  }

  const user = session.user as User;
  
  // Vérifier que l'utilisateur a accès au module Patronat
  // TODO: Vérifier le rôle et le tenant.type = 'PATRONAT'
  
  // TODO: Charger le tenant Patronat depuis la DB
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

  // TODO: Charger l'année scolaire active
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
      <PatronatDashboard tenantId={patronat.id} />
    </PatronatLayout>
  );
}

