/**
 * ============================================================================
 * DASHBOARD GUARD - PROTECTION DES DASHBOARDS
 * ============================================================================
 * 
 * Composant qui protège les dashboards en vérifiant :
 * - Authentification
 * - Tenant sélectionné
 * - Contexte valide
 * 
 * ============================================================================
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantContext } from '@/contexts/TenantContext';

interface DashboardGuardProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
}

export function DashboardGuard({ children, requiredRole }: DashboardGuardProps) {
  const { context, isLoading, error } = useTenantContext();
  const router = useRouter();

  useEffect(() => {
    // Attendre le chargement du contexte
    if (isLoading) return;

    // Vérifier les erreurs
    if (error) {
      console.error('Context error:', error);
      router.push('/auth/login');
      return;
    }

    // Vérifier que le contexte est chargé
    if (!context) {
      console.warn('No context available');
      router.push('/auth/select-tenant');
      return;
    }

    // Vérifier le tenant
    if (!context.tenant || context.tenant.status !== 'active') {
      console.warn('Invalid tenant');
      router.push('/auth/select-tenant');
      return;
    }

    // Vérifier l'année académique (optionnel selon le rôle)
    const rolesWithoutAcademicYear = ['PLATFORM_OWNER'];
    if (!context.academicYear && !rolesWithoutAcademicYear.includes(context.role)) {
      console.warn('No active academic year');
      // Ne pas bloquer, juste logger
    }

    // Vérifier le rôle requis
    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(context.role)) {
        console.warn(`Role ${context.role} not allowed. Required: ${roles.join(', ')}`);
        router.push('/dashboard');
        return;
      }
    }
  }, [context, isLoading, error, requiredRole, router]);

  // Afficher un loader pendant le chargement
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du contexte...</p>
        </div>
      </div>
    );
  }

  // Afficher une erreur si le contexte n'est pas disponible
  if (error || !context) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Erreur de chargement du contexte</p>
          <p className="text-gray-600 mt-2">{error || 'Contexte non disponible'}</p>
        </div>
      </div>
    );
  }

  // Vérifier que le contexte est valide
  if (!context.tenant || context.tenant.status !== 'active') {
    return null; // La redirection est gérée dans useEffect
  }

  return <>{children}</>;
}
