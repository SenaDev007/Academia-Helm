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
 *
 * DURÉE MINIMALE : Le loading screen dure au moins 5 secondes
 * pour une expérience visuelle agréable (progression fluide).
 */

/** Durée minimale d'affichage du loading screen (ms) */
const MIN_LOADING_DURATION_MS = 5000;

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
 *
 * OPTIMISÉ : les étapes indépendantes s'exécutent en parallèle
 * pour réduire le temps de chargement après authentification.
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

  // Garantir un minimum de 5 secondes pour le loading screen
  const startTime = Date.now();
  const ensureMinDuration = async () => {
    const elapsed = Date.now() - startTime;
    const remaining = MIN_LOADING_DURATION_MS - elapsed;
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
  };

  let user: User | null = null;
  let tenant: Tenant | null = null;
  let academicYear: PostLoginFlowResult['academicYear'] = null;
  let permissions: string[] = [];
  let orionAlerts: PostLoginFlowResult['orionAlerts'] = [];

  try {
    // ─── Phase 1 : Authentification (bloquant) ─────────────
    onProgress?.({
      step: 'INIT_SECURE_CONTEXT',
      progress: 10,
      message: getLoadingMessage('INIT_SECURE_CONTEXT').title,
      subtitle: getLoadingMessage('INIT_SECURE_CONTEXT').subtitle,
    });

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

    const isPlatformOwner = user.role === 'PLATFORM_OWNER' || (user as any).isPlatformOwner;
    if (!tenant && !isPlatformOwner) {
      throw {
        step: 'INIT_SECURE_CONTEXT' as LoadingStep,
        message: 'Établissement introuvable',
        code: 'TENANT_NOT_FOUND',
      };
    }

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

    if (tenant && (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED')) {
      throw {
        step: 'INIT_SECURE_CONTEXT' as LoadingStep,
        message: 'Compte suspendu ou en attente',
        code: 'TENANT_SUSPENDED',
      };
    }

    onProgress?.({ step: 'INIT_SECURE_CONTEXT', progress: 25, message: 'Contexte sécurisé' });

    // ─── Phase 2 : Étapes indépendantes en PARALLÈLE ──────
    // Année scolaire, permissions, offline, ORION et préchargement
    // peuvent tous s'exécuter simultanément (aucune dépendance entre eux)

    onProgress?.({
      step: 'VERIFY_ACADEMIC_YEAR',
      progress: 35,
      message: 'Chargement des données...',
      subtitle: 'Initialisation en parallèle',
    });

    // Permissions — synchrone, résout immédiatement
    permissions = getPermissionsForRole(user.role);

    // Lancer toutes les opérations asynchrones en parallèle
    const [academicYearResult, offlineResult, orionResult] = await Promise.all([
      // Année scolaire (avec timeout 8s pour ne pas bloquer)
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch('/api/academic-years', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            const years = await response.json();
            const activeYear = years.find((y: any) => y.isCurrent);
            if (!activeYear && !isPlatformOwner) {
              return { error: { step: 'VERIFY_ACADEMIC_YEAR', message: 'Aucune année scolaire active', code: 'NO_ACADEMIC_YEAR' } };
            }
            if (activeYear) {
              return { data: {
                id: activeYear.id, name: activeYear.name,
                startDate: activeYear.startDate, endDate: activeYear.endDate,
                isCurrent: activeYear.isCurrent,
              }};
            }
          }
          return { data: null };
        } catch (err: any) {
          if (err.code) return { error: err };
          console.error('Failed to load academic year:', err);
          return { data: null };
        }
      })(),

      // Offline + Outbox (en parallèle interne)
      (async () => {
        const isOnline = networkDetectionService.isConnected();
        let pendingOperations = 0;

        const offlineTasks: Promise<void>[] = [];

        if (tenant?.id) {
          // Outbox check — rapide, on l'attend
          offlineTasks.push(
            import('@/lib/offline/outbox.service').then(async ({ outboxService }) => {
              const pendingEvents = await outboxService.getPendingEvents(tenant!.id);
              pendingOperations = pendingEvents.length;
            }).catch((error) => console.error('Failed to check pending operations:', error))
          );
        }

        await Promise.all(offlineTasks);

        // Bootstrap offline — FIRE-AND-FORGET (ne pas bloquer le chargement)
        // Lancé APRÈS les tâches critiques pour ne pas les ralentir
        if (tenant?.id && isOnline) {
          import('@/lib/offline/offline-bootstrap.service').then(({ offlineBootstrapService }) => {
            void offlineBootstrapService.ensureBootstrapped(tenant!.id);
          }).catch(() => { /* non-critical */ });
        }

        return { isOnline, pendingOperations };
      })(),

      // ORION alerts (direction only, timeout 5s)
      (async () => {
        if (['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'PLATFORM_OWNER'].includes(user!.role) && tenant?.id) {
          try {
            const rawAlerts = await Promise.race([
              getOrionAlerts({ level: 'CRITIQUE', acknowledged: false }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
            ]);
            const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
            return alerts.slice(0, 5).map((alert: any) => ({
              id: alert.id, level: alert.level, message: alert.title || alert.message || '',
            }));
          } catch (error) {
            console.error('Failed to load ORION alerts:', error);
            return [];
          }
        }
        return [];
      })(),
    ]);

    // Traiter le résultat de l'année scolaire
    if (academicYearResult.error) throw academicYearResult.error;
    academicYear = (academicYearResult as any).data || null;

    // Traiter le résultat offline
    const offlineStatus = (offlineResult as any) || { isOnline: true, pendingOperations: 0 };

    // Traiter les alertes ORION
    orionAlerts = orionResult as PostLoginFlowResult['orionAlerts'];

    // ─── Phase 3 : Préchargement UI (non-bloquant) ─────────
    // Les composants PilotageLayout/TopBar/Sidebar sont déjà
    // dynamiquement importés dans layout.tsx, ce préchargement
    // est donc redondant — on le rend non-bloquant.

    onProgress?.({
      step: 'PRELOAD_UI',
      progress: 90,
      message: 'Presque prêt...',
    });

    // Préchargement en arrière-plan (ne pas await)
    Promise.all([
      import('@/components/pilotage/PilotageLayout'),
      import('@/components/pilotage/PilotageTopBar'),
      import('@/components/pilotage/PilotageSidebar'),
    ]).catch(() => { /* non-critical */ });

    // Finalisation — attendre la durée minimale de 5 secondes
    // avec une progression fluide de 90% à 100%
    const preFinalProgress = 90;
    const remainingTime = Math.max(0, MIN_LOADING_DURATION_MS - (Date.now() - startTime));
    if (remainingTime > 0) {
      // Animer la progression de 90% à 100% pendant le temps restant
      const progressSteps = 10;
      const stepDuration = remainingTime / progressSteps;
      for (let i = 1; i <= progressSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
        onProgress?.({
          step: 'PRELOAD_UI',
          progress: preFinalProgress + i,
          message: i >= progressSteps ? 'Prêt' : 'Presque prêt...',
        });
      }
    } else {
      onProgress?.({ step: 'PRELOAD_UI', progress: 100, message: 'Prêt' });
    }

    const duration = performanceAuditService.endTimer(metricId, 'POST_LOGIN', {
      stepsCompleted: steps.length,
      hasOrion: orionAlerts.length > 0,
      isOnline: offlineStatus.isOnline,
      pendingOperations: offlineStatus.pendingOperations,
    });

    return {
      success: true,
      user,
      tenant: tenant!,
      academicYear,
      permissions,
      offlineStatus: {
        isOnline: offlineStatus.isOnline,
        pendingOperations: offlineStatus.pendingOperations,
        syncRequired: !offlineStatus.isOnline && offlineStatus.pendingOperations > 0,
      },
      orionAlerts,
    };
  } catch (error: any) {
    // Même en cas d'erreur, respecter la durée minimale d'affichage
    await ensureMinDuration();

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
