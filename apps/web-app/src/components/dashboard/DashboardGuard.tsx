/**
 * ============================================================================
 * DASHBOARD GUARD - PROTECTION DES DASHBOARDS (OFFLINE-AWARE)
 * ============================================================================
 *
 * Composant qui protège les dashboards en vérifiant :
 * - Authentification
 * - Tenant sélectionné
 * - Contexte valide
 *
 * AMÉLIORATION OFFLINE : Ne redirige PAS vers login quand hors ligne.
 * Affiche un message d'attente ou utilise le cache si disponible.
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTenantContext } from '@/contexts/TenantContext';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { WifiOff, RefreshCw } from 'lucide-react';

interface DashboardGuardProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
}

export function DashboardGuard({ children, requiredRole }: DashboardGuardProps) {
  const { context, isLoading, error } = useTenantContext();
  const router = useRouter();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);
  const [isOnline, setIsOnline] = useState(networkDetectionService.isConnected());

  // Surveiller l'état de la connexion
  useEffect(() => {
    const handleConnectionChange = (online: boolean) => {
      setIsOnline(online);
    };
    networkDetectionService.onConnectionChange(handleConnectionChange);
    return () => {
      networkDetectionService.removeListener(handleConnectionChange);
    };
  }, []);

  useEffect(() => {
    // Attendre le chargement du contexte
    if (isLoading) return;

    // HORS LIGNE : ne PAS rediriger vers login, même si le contexte échoue
    // L'utilisateur doit pouvoir continuer à travailler avec le cache
    if (!isOnline) {
      if (!context && !error) {
        // Pas de contexte mais pas d'erreur non plus — on laisse passer
        // Le contexte sera chargé depuis le cache
        return;
      }
      // En mode hors ligne, on ne redirige jamais vers login
      return;
    }

    // EN LIGNE : comportement normal avec redirections

    // Vérifier les erreurs
    if (error) {
      console.error('Context error:', error);
      router.push('/auth/login');
      return;
    }

    // Vérifier que le contexte est chargé
    if (!context) {
      console.warn('No context available');
      router.push('/auth/login');
      return;
    }

    // Vérifier le tenant
    if (!context.tenant || context.tenant.status !== 'active') {
      console.warn('Invalid tenant');
      if (context.role === 'PLATFORM_OWNER' || context.user?.isPlatformOwner) {
        router.push('/platform');
      } else {
        router.push('/auth/login');
      }
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
  }, [context, isLoading, error, requiredRole, router, isOnline]);

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

  // HORS LIGNE avec erreur de contexte : afficher un message d'attente au lieu de rediriger
  if (!isOnline && (error || !context)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Mode hors ligne</h2>
          <p className="text-gray-600 mb-6">
            Le contexte n'a pas pu être chargé. Vos données seront disponibles une fois la connexion rétablie.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </motion.div>
      </div>
    );
  }

  // Afficher une erreur si le contexte n'est pas disponible (en ligne)
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
