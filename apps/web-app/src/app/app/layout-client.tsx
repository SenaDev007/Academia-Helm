/**
 * App Layout Client Component
 * 
 * Composant client pour gérer le flow post-login
 * Wrapper autour du layout serveur
 */

'use client';

import { Suspense, useEffect } from 'react';
import { PostLoginFlowWrapper } from '@/components/loading/PostLoginFlowWrapper';
import { QueryProvider } from '@/providers/QueryProvider';
import { SettingsBootstrapPrefetch } from '@/components/settings/SettingsBootstrapPrefetch';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import { BilingualProvider } from '@/contexts/BilingualContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SessionManagerProvider } from '@/contexts/SessionManagerContext';
import SessionInactivityModal from '@/components/auth/SessionInactivityModal';
import SessionLockScreen from '@/components/auth/SessionLockScreen';
import { motion } from 'framer-motion';
import { getFadeMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import { ReviewPromptHost } from '@/components/reviews/ReviewPromptHost';
import { CrispChat } from '@/components/CrispChat';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';
import { TenantThemeProvider } from '@/providers/TenantThemeProvider';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { Toaster } from '@/components/ui/sonner';
// ⭐ Sarah Guide In-App — assistant de navigation global (Academia Helm branding)
// Connecté à /sara/guide/stream (GLM 5.2). Aucun accès aux données tenant.
import InAppSaraGuideWidget from '@/components/ai/InAppSaraGuideWidget';
import OnboardingTour from '@/components/ai/OnboardingTour';
// ⭐ Offline-first : bannière hors ligne + badge statut réseau + prompt d'installation PWA + SW offline + modal sync
import OfflineGuard from '@/components/offline/OfflineGuard';
import { OfflineStatusBadge } from '@/components/offline/OfflineStatusBadge';
import { OfflineSWRegister } from '@/components/offline/OfflineSWRegister';
import { SyncModal } from '@/components/offline/SyncModal';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

export interface AppLayoutClientProps {
  children: React.ReactNode;
  user: User;
  tenant: Tenant;
}

/**
 * Layout client pour l'application
 * 
 * Gère le flow post-login avant d'afficher le contenu.
 * AppSessionProvider expose user/tenant aux pages (ex. paramètres en mode PO).
 * SessionManagerProvider gère l'inactivité, le verrouillage et le refresh proactif.
 */
export default function AppLayoutClient({
  children,
  user,
  tenant,
}: AppLayoutClientProps) {
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);

  // Abonnement Web Push (notifications navigateur, même onglet fermé)
  // Actif seulement si VAPID configuré côté backend + permission utilisateur granted
  const { status: pushStatus } = usePushSubscription(true);
  if (typeof window !== 'undefined' && pushStatus === 'subscribed') {
    // Console-only log (utile pour debug)
    console.log('[Push] Abonnement actif');
  }

  // ⭐ Bootstrap offline-first : au premier login, télécharger TOUTES les données
  //    du tenant dans IndexedDB pour permettre le mode offline.
  useEffect(() => {
    if (!tenant?.id) return;
    // Vérifier si déjà bootstrapé
    if (localStorage.getItem('academia_helm_bootstrapped') === 'true') return;

    import('@/lib/offline/offline-sync.service').then(({ offlineSyncService }) => {
      offlineSyncService.bootstrap(tenant.id);
    }).catch((err) => {
      console.warn('[Bootstrap] Failed:', err);
    });
  }, [tenant?.id]);

  return (
    <SessionManagerProvider>
      {/* ⭐ Offline-first : bannière orange si hors ligne */}
      <OfflineGuard>
      <motion.div
        initial={fadeMotion.initial}
        animate={fadeMotion.animate}
        transition={fadeMotion.transition}
      >
        {/* Bandeau d'abonnement (GRACE_PERIOD / SUSPENDED) */}
        <SubscriptionBanner tenantId={tenant?.id} />
        <I18nProvider>
          <QueryProvider>
            <AppSessionProvider user={user} tenant={tenant}>
              <Suspense fallback={null}>
                <SettingsBootstrapPrefetch />
              </Suspense>
              <Suspense fallback={null}>
                <AcademicYearProvider>
                  <SchoolLevelProvider>
                    <BilingualProvider>
                      <TenantThemeProvider>
                        <ReviewPromptHost user={user} tenant={tenant}>
                          <PostLoginFlowWrapper user={user} tenant={tenant}>
                            {children}
                          </PostLoginFlowWrapper>
                        </ReviewPromptHost>
                      </TenantThemeProvider>
                    </BilingualProvider>
                  </SchoolLevelProvider>
                </AcademicYearProvider>
              </Suspense>
            </AppSessionProvider>
          </QueryProvider>
        </I18nProvider>
      </motion.div>

      {/* Modaux et écrans de session — montés hors du layout principal */}
      <SessionInactivityModal />
      <SessionLockScreen />
      <CrispChat />
      {/* ⭐ Sarah Guide In-App — assistant de navigation flottant
          Global (pas multi-tenant strict). Aide à la navigation, onboarding,
          explication des modules. Redirige vers ORION (données) et ATLAS (actions). */}
      <InAppSaraGuideWidget />
      {/* ⭐ OnboardingTour — parcours guidé par Sarah au premier login */}
      <OnboardingTour />
      {/* ⭐ Toaster (sonner) — affiche les toast.success/toast.error partout
          dans l'app (sans lui, les notifications sont silencieuses) */}
      <Toaster richColors position="top-right" closeButton />
      {/* ⭐ Offline-first : badge statut réseau + prompt d'installation PWA + SW offline */}
      <OfflineStatusBadge />
      <PWAInstallPrompt />
      <OfflineSWRegister />
      <SyncModal />
      </OfflineGuard>
    </SessionManagerProvider>
  );
}
