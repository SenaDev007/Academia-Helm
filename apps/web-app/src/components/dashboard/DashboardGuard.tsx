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
import { motion } from 'framer-motion';
import { useTenantContext } from '@/contexts/TenantContext';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

interface DashboardGuardProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
}

export function DashboardGuard({ children, requiredRole }: DashboardGuardProps) {
  const { context, isLoading, error } = useTenantContext();
  const router = useRouter();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du contexte...</p>
        </motion.div>
      </div>
    );
  }

  // Afficher une erreur si le contexte n'est pas disponible
  if (error || !context) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-red-600">Erreur de chargement du contexte</p>
          <p className="text-gray-600 mt-2">{error || 'Contexte non disponible'}</p>
        </motion.div>
      </div>
    );
  }

  // Vérifier que le contexte est valide
  if (!context.tenant || context.tenant.status !== 'active') {
    return null; // La redirection est gérée dans useEffect
  }

  return (
    <motion.div
      initial={pageMotion.initial}
      animate={pageMotion.animate}
      transition={pageMotion.transition}
    >
      {children}
    </motion.div>
  );
}
