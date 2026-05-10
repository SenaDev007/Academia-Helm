/**
 * ============================================================================
 * PAGE DE TEST - ACCÈS DIRECT À L'INTERFACE DE PILOTAGE
 * ============================================================================
 * 
 * Page de test pour accéder directement à l'interface de pilotage
 * sans authentification (pour les tests uniquement)
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PilotageLayout from '@/components/pilotage/PilotageLayout';
import DirectorDashboard from '@/components/pilotage/dashboards/DirectorDashboard';
import type { User, Tenant } from '@/types';

export default function AppTestPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Utilisateur mock pour les tests
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@academiahub.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'SUPER_DIRECTOR',
    tenantId: 'test-tenant-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTenant: Tenant = {
    id: 'test-tenant-id',
    name: 'École de Test',
    slug: 'test-tenant',
    subdomain: 'test',
    status: 'active',
    subscriptionStatus: 'ACTIVE_SUBSCRIBED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trialEndsAt: undefined,
    nextPaymentDueAt: undefined,
  } as Tenant as Tenant;

  useEffect(() => {
    // Simuler un chargement initial
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'interface de pilotage...</p>
        </div>
      </div>
    );
  }

  return (
    <PilotageLayout user={mockUser} tenant={mockTenant}>
      <DirectorDashboard tenantId={mockTenant.id} />
    </PilotageLayout>
  );
}

