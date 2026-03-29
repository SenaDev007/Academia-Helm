/**
 * Post-Login Flow Service
 * 
 * Service pour orchestrer le flow post-login strict en 6 étapes
 * 
 * ORDRE STRICT :
 * 1. Initialisation contexte sécurisé
 * 2. Vérification année scolaire
 * 3. Chargement rôles & permissions
 * 4. Vérification offline-first
 * 5. Initialisation ORION (direction uniquement)
 * 6. Préchargement UI
 */

import type { User, Tenant } from '@/types';
import { getLoadingMessage, type LoadingStep } from './loading-messages';
import { checkAuth } from '@/services/auth.service';
import { getTenantBySubdomain } from '@/services/tenant.service';
import { getOrionAlerts } from '@/services/orion.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { performanceAuditService } from '@/lib/performance/performance-audit.service';

export interface PostLoginFlowResult {
  success: boolean;
  user: User;
  tenant: Tenant;
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  } | null;
  permissions: string[];
  offlineStatus: {
    isOnline: boolean;
    pendingOperations: number;
    syncRequired: boolean;
  };
  orionAlerts: Array<{
    id: string;
    level: 'INFO' | 'ATTENTION' | 'CRITIQUE';
    message: string;
  }>;
  error?: {
    step: LoadingStep;
    message: string;
    code: string;
  };
}

export interface PostLoginFlowProgress {
  step: LoadingStep;
  progress: number; // 0-100
  message: string;
  subtitle?: string;
}

type ProgressCallback = (progress: PostLoginFlowProgress) => void;

/**
 * Exécute le flow post-login complet
 */
export async function executePostLoginFlow(
  onProgress?: ProgressCallback
): Promise<PostLoginFlowResult> {
  const steps: LoadingStep[] = [
    'INIT_SECURE_CONTEXT',
    'VERIFY_ACADEMIC_YEAR',
    'LOAD_ROLES_PERMISSIONS',
    'CHECK_OFFLINE_STATUS',
    'INIT_ORION',
    'PRELOAD_UI',
  ];

  // Démarrer le timer de performance
  const metricId = `post-login-${Date.now()}`;
  performanceAuditService.startTimer(metricId);

  let user: User | null = null;
  let tenant: Tenant | null = null;
  let academicYear: PostLoginFlowResult['academicYear'] = null;
  let permissions: string[] = [];
  let orionAlerts: PostLoginFlowResult['orionAlerts'] = [];

  try {
    // Étape 1 : Initialisation contexte sécurisé
    const step1Message = getLoadingMessage('INIT_SECURE_CONTEXT');
    onProgress?.({
      step: 'INIT_SECURE_CONTEXT',
      progress: 15,
      message: step1Message.title,
      subtitle: step1Message.subtitle,
    });

    // Vérifier l'authentification
    const authData = await checkAuth();
    if (!authData || !authData.user) {
      throw {
        step: 'INIT_SECURE_CONTEXT' as LoadingStep,
        message: 'Erreur d\'authentification',
        code: 'AUTH_ERROR',
      };
    }

    user = authData.user;
    tenant = authData.tenant || null;

    if (!tenant) {
      // Essayer de charger le tenant depuis le sous-domaine
      const host = typeof window !== 'undefined' ? window.location.host : '';
      const parts = host.split('.');
      const subdomain = parts.length > 2 ? parts[0] : null;

      if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
        try {
          tenant = await getTenantBySubdomain(subdomain);
        } catch (error) {
          console.error('Failed to load tenant:', error);
        }
      }
    }

    // PLATFORM_OWNER : accepter un tenant vide (pas de throw)
    const isPlatformOwner = user.role === 'PLATFORM_OWNER' || (user as any).isPlatformOwner;
    if (!tenant && !isPlatformOwner) {
      throw {
        step: 'INIT_SECURE_CONTEXT' as LoadingStep,
        message: 'Établissement introuvable',
        code: 'TENANT_NOT_FOUND',
      };
    }

    // Créer un tenant virtuel pour PLATFORM_OWNER si nécessaire
    if (isPlatformOwner && !tenant) {
      tenant = {
        id: '',
        name: 'Plateforme',
        slug: '',
        subdomain: '',
        status: 'active',
        subscriptionStatus: 'ACTIVE_SUBSCRIBED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trialEndsAt: undefined,
        nextPaymentDueAt: undefined,
      };
    }

    // Vérifier l'état du compte
    if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
      throw {
        step: 'INIT_SECURE_CONTEXT' as LoadingStep,
        message: 'Compte suspendu ou en attente',
        code: 'TENANT_SUSPENDED',
      };
    }

    // Attendre la durée minimale
    await waitMinimum(step1Message.duration || 300);

    // Étape 2 : Vérification année scolaire
    const step2Message = getLoadingMessage('VERIFY_ACADEMIC_YEAR');
    onProgress?.({
      step: 'VERIFY_ACADEMIC_YEAR',
      progress: 30,
      message: step2Message.title,
      subtitle: step2Message.subtitle,
    });

    try {
      const academicYearResponse = await fetch('/api/academic-years');
      if (academicYearResponse.ok) {
        const years = await academicYearResponse.json();
        const activeYear = years.find((y: any) => y.isCurrent);

        // PLATFORM_OWNER n'a pas besoin d'une année scolaire active
        if (!activeYear && !isPlatformOwner) {
          throw {
            step: 'VERIFY_ACADEMIC_YEAR' as LoadingStep,
            message: 'Aucune année scolaire active',
            code: 'NO_ACADEMIC_YEAR',
          };
        }

        academicYear = {
          id: activeYear.id,
          name: activeYear.name,
          startDate: activeYear.startDate,
          endDate: activeYear.endDate,
          isCurrent: activeYear.isCurrent,
        };

        // Vérifier les dates
        const now = new Date();
        const startDate = new Date(activeYear.startDate);
        const endDate = new Date(activeYear.endDate);

        if (now < startDate || now > endDate) {
          console.warn('Academic year dates are outside current period');
        }
      }
    } catch (error: any) {
      if (error.code) throw error;
      console.error('Failed to load academic year:', error);
    }

    await waitMinimum(step2Message.duration || 200);

    // Étape 3 : Chargement rôles & permissions
    const step3Message = getLoadingMessage('LOAD_ROLES_PERMISSIONS');
    onProgress?.({
      step: 'LOAD_ROLES_PERMISSIONS',
      progress: 50,
      message: step3Message.title,
      subtitle: step3Message.subtitle,
    });

    // Déterminer les permissions basées sur le rôle
    permissions = getPermissionsForRole(user.role);

    await waitMinimum(step3Message.duration || 200);

    // Étape 4 : Vérification offline-first
    const step4Message = getLoadingMessage('CHECK_OFFLINE_STATUS');
    onProgress?.({
      step: 'CHECK_OFFLINE_STATUS',
      progress: 65,
      message: step4Message.title,
      subtitle: step4Message.subtitle,
    });

    const isOnline = networkDetectionService.isConnected();
    let pendingOperations = 0;

    if (tenant && tenant.id) {
      try {
        // Charger dynamiquement pour éviter les problèmes de circular dependency
        const { outboxService } = await import('@/lib/offline/outbox.service');
        const pendingEvents = await outboxService.getPendingEvents(tenant.id);
        pendingOperations = pendingEvents.length;
      } catch (error) {
        console.error('Failed to check pending operations:', error);
      }
    }

    await waitMinimum(step4Message.duration || 300);

    // Étape 5 : Initialisation ORION (direction uniquement)
    const step5Message = getLoadingMessage('INIT_ORION');
    onProgress?.({
      step: 'INIT_ORION',
      progress: 80,
      message: step5Message.title,
      subtitle: step5Message.subtitle,
    });

    // ORION uniquement pour les rôles direction (tenir compte du tenant avec id)
    if (['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'PLATFORM_OWNER'].includes(user.role) && tenant?.id) {
      try {
        const rawAlerts = await getOrionAlerts('CRITIQUE', false);
        const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
        orionAlerts = alerts.slice(0, 5).map((alert) => ({
          id: alert.id,
          level: alert.level,
          message: alert.message,
        }));
      } catch (error) {
        console.error('Failed to load ORION alerts:', error);
        // Ne pas bloquer le flow si ORION échoue
      }
    }

    await waitMinimum(step5Message.duration || 500);

    // Étape 6 : Préchargement UI
    const step6Message = getLoadingMessage('PRELOAD_UI');
    onProgress?.({
      step: 'PRELOAD_UI',
      progress: 95,
      message: step6Message.title,
      subtitle: step6Message.subtitle,
    });

    // Précharger les composants critiques
    await Promise.all([
      import('@/components/pilotage/PilotageLayout'),
      import('@/components/pilotage/PilotageTopBar'),
      import('@/components/pilotage/PilotageSidebar'),
    ]);

    await waitMinimum(step6Message.duration || 200);

    // Finalisation
    onProgress?.({
      step: 'PRELOAD_UI',
      progress: 100,
      message: 'Prêt',
    });

    // Enregistrer la métrique de performance
    const duration = performanceAuditService.endTimer(metricId, 'POST_LOGIN', {
      stepsCompleted: steps.length,
      hasOrion: orionAlerts.length > 0,
      isOnline,
      pendingOperations,
    });

    return {
      success: true,
      user,
      tenant: tenant!,
      academicYear,
      permissions,
      offlineStatus: {
        isOnline,
        pendingOperations,
        syncRequired: !isOnline && pendingOperations > 0,
      },
      orionAlerts,
    };
  } catch (error: any) {
    return {
      success: false,
      user: user!,
      tenant: tenant!,
      academicYear,
      permissions,
      offlineStatus: {
        isOnline: networkDetectionService.isConnected(),
        pendingOperations: 0,
        syncRequired: false,
      },
      orionAlerts: [],
      error: {
        step: error.step || 'INIT_SECURE_CONTEXT',
        message: error.message || 'Erreur lors de l\'initialisation',
        code: error.code || 'UNKNOWN_ERROR',
      },
    };
  }
}

/**
 * Obtient les permissions pour un rôle
 */
function getPermissionsForRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    PLATFORM_OWNER: ['*'],
    SUPER_DIRECTOR: ['*'],
    DIRECTOR: [
      'dashboard:view',
      'orion:view',
      'orion:query',
      'students:view',
      'finance:view',
      'pedagogy:view',
    ],
    ADMIN: [
      'dashboard:view',
      'settings:view',
      'settings:edit',
      'users:view',
      'users:edit',
    ],
    ACCOUNTANT: [
      'dashboard:view',
      'finance:view',
      'finance:edit',
      'payments:view',
      'payments:edit',
    ],
    TEACHER: [
      'dashboard:view',
      'pedagogy:view',
      'pedagogy:edit',
      'students:view',
    ],
  };

  return rolePermissions[role] || [];
}

/**
 * Attend un délai minimum
 */
function waitMinimum(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
