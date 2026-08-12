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
import AppGate from '@/components/auth/AppGate';
import { SyncModal } from '@/components/offline/SyncModal';
import ConflictResolutionModal from '@/components/offline/ConflictResolutionModal';
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

  // ⭐ TAURI : sauvegarder le token + tenant dans le Tauri Store pour le sync engine Rust
  //    Quand le web-app est chargé dans la webview Tauri, on détecte window.__TAURI__
  //    et on persiste les infos d'auth pour que sync.html puisse les récupérer.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tauri = (window as any).__TAURI__;
    if (!tauri?.store?.Store) return;

    (async () => {
      try {
        const store = await tauri.store.Store.load('academia-helm-store.json');

        // Récupérer le token depuis localStorage
        const sessionRaw = localStorage.getItem('session');
        if (sessionRaw) {
          const session = JSON.parse(sessionRaw);
          if (session.accessToken) {
            await store.set('accessToken', session.accessToken);
          }
          if (session.refreshToken) {
            await store.set('refreshToken', session.refreshToken);
          }
        }

        // Sauvegarder le tenant
        if (tenant?.id) {
          await store.set('tenantId', tenant.id);
          await store.set('selectedSchool', {
            tenantId: tenant.id,
            subdomain: tenant.subdomain || tenant.slug || '',
            name: tenant.name || tenant.label || '',
          });
        }

        await store.save();
        console.log('[Tauri] Token + tenant saved to Tauri Store');
      } catch (e) {
        // Non-bloquant — le web-app fonctionne sans Tauri Store
      }
    })();
  }, [tenant?.id]);

  // ⭐ Installer l'intercepteur global de fetch (offline-first pour TOUS les GET /api/*)
  //    Le plus tôt possible — avant tout autre useEffect.
  useEffect(() => {
    import('@/lib/offline/global-fetch-interceptor').then(({ installGlobalFetchInterceptor }) => {
      installGlobalFetchInterceptor();
    }).catch(() => {});
  }, []);

  // ⭐ Bootstrap offline-first : au premier login, télécharger TOUTES les données
  //    du tenant dans IndexedDB pour permettre le mode offline.
  // ⭐ FIX : re-bootstrap si le tenant change (multi-tenant,切换 école).
  //    Avant : le flag 'academia_helm_bootstrapped' restait 'true' même si
  //    l'utilisateur changeait de tenant → IndexedDB n'était jamais re-bootstrapé
  //    pour le nouveau tenant.
  useEffect(() => {
    if (!tenant?.id) return;

    // Vérifier si déjà bootstrapé POUR CE tenant spécifiquement
    const bootstrapKey = `academia_helm_bootstrapped_${tenant.id}`;
    if (localStorage.getItem(bootstrapKey) === 'true') return;

    // Marquer comme bootstrapé pour ce tenant
    localStorage.setItem(bootstrapKey, 'true');

    import('@/lib/offline/offline-sync.service').then(({ offlineSyncService }) => {
      offlineSyncService.bootstrap(tenant.id);
    }).catch((err) => {
      console.warn('[Bootstrap] Failed:', err);
    });
  }, [tenant?.id]);

  return (
    <>
    {/* ⭐ OFFLINE-FIRST : OfflineSWRegister monté EN HAUT de l'arbre (avant
        SessionManagerProvider et QueryProvider) pour que le Service Worker
        soit enregistré AVANT que les premières requêtes API ne partent.
        Avant : monté en bas de l'arbre → le SW n'était pas actif quand les
        premières requêtes fetch() étaient émises → pas de cache offline. */}
    <OfflineSWRegister />
    {/* ⭐ TAURI : AppGate remplace le middleware côté client (résolution tenant + validation session) */}
    <AppGate>
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
      {/* ⭐ Offline-first : badge statut réseau + prompt d'installation PWA */}
      <OfflineStatusBadge />
      <PWAInstallPrompt />
      {/* ⭐ OfflineSWRegister déplacé EN HAUT de l'arbre (voir plus haut) */}
      <SyncModal />
      <ConflictResolutionModal />
      </OfflineGuard>
    </SessionManagerProvider>
    </AppGate>
    </>
  );
}
