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
// ⭐ P4-bis (filtre Rôles × Pistes × Niveaux) : chargement du périmètre serveur
import { persistUserScope } from '@/lib/auth/user-scope';
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
// ⭐ RÉACTIVÉ (sept. 2026) — spécification « mode hors-ligne offline-first » :
//    lecture intégrale hors ligne + file de mutations + sync auto au retour réseau.
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

  // ⭐ P4-bis (filtre Rôles × Pistes × Niveaux) : charger le périmètre serveur
  //    au montage de l'app (tous portails). Le login enseignant le livre
  //    directement dans sa réponse, mais les comptes du portail ÉCOLE
  //    (directeurs, secrétaires…) ne l'obtiennent QUE via /context/bootstrap.
  //    On le récupère ici (1 fetch par chargement de page) → persistUserScope
  //    → événement user-scope-loaded → I18nContext/BilingualContext appliquent
  //    la langue du profil + verrouillent la piste (mono-piste).
  //    NB : silencieux en cas d'échec (offline, token expiré) — l'UI retombe
  //    sur la locale mémorisée.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/context/bootstrap', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.scope) {
          persistUserScope(data.scope);
        }
      } catch {
        /* non-bloquant */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ⭐ OFFLINE-FIRST RÉACTIVÉ (sept. 2026 — spec mode hors-ligne) :
  //    intercepteur global de fetch + auto-sync + bootstrap IDB + précache modules.

  // ⭐ Installer l'intercepteur global de fetch (offline-first pour TOUS les GET /api/*)
  useEffect(() => {
    import('@/lib/offline/global-fetch-interceptor').then(({ installGlobalFetchInterceptor }) => {
      installGlobalFetchInterceptor();
    }).catch(() => {});
  }, []);

  // ⭐ AUTO-SYNC : déclencher push+pull automatiquement au retour du réseau
  useEffect(() => {
    if (!tenant?.id) return;
    import('@/lib/offline/auto-sync-trigger').then(({ initAutoSyncTrigger }) => {
      initAutoSyncTrigger(tenant.id);
    }).catch(() => {});
  }, [tenant?.id]);

  // ⭐ Bootstrap offline-first : au premier login, télécharger TOUTES les données
  //    (données métier IDB + chunks JS des 121 routes /app/* pour naviguer hors ligne)
  //    ⭐ FIX (sept. 2026) : le flag « déjà bootstrapé » n'est posé qu'APRÈS le
  //    succès du téléchargement. Avant : posé au démarrage → si le bootstrap
  //    échouait (réseau instable, onglet fermé), il n'était JAMAIS retenté.
  //    ⭐ TENANT-STRICT (sept. 2026) : avant tout, vérifier que le cache local
  //    appartient bien à l'école connectée. Si un utilisateur d'une AUTRE école
  //    s'était connecté sur cet appareil, on purge son cache (aucune donnée
  //    cross-tenant ne doit rester servable offline) et on relance un bootstrap
  //    complet pour l'école courante.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      // 1. Cohérence tenant du cache local (lecture légère IDB ; purge si autre école)
      try {
        const { offlineBootstrapService } = await import('@/lib/offline/offline-bootstrap.service');
        await offlineBootstrapService.ensureTenantCacheCoherence(tenant.id);
      } catch (err) {
        console.warn('[Bootstrap] Tenant coherence check failed:', err);
      }
      if (cancelled) return;

      // 2. Bootstrap si pas encore fait pour CE tenant
      const bootstrapKey = `academia_helm_bootstrapped_${tenant.id}`;
      if (localStorage.getItem(bootstrapKey) === 'true') return;
      bootstrapTimer = setTimeout(() => {
        import('@/lib/offline/offline-sync.service').then(({ offlineSyncService }) => {
          // ⭐ Flag posé SEULEMENT après un bootstrap réussi (sinon retry au prochain mount)
          offlineSyncService.bootstrap(tenant.id).then((ok) => {
            if (ok) {
              localStorage.setItem(bootstrapKey, 'true');
            } else {
              console.warn('[Bootstrap] Échec — le bootstrap sera retenté au prochain chargement');
            }
          });
        }).catch((err) => {
          console.warn('[Bootstrap] Failed to import offline-sync.service:', err);
        });
      }, 5000);
    })();

    // Cleanup : annule le flag ET le timer de bootstrap (IIFE async)
    return () => {
      cancelled = true;
      if (bootstrapTimer) clearTimeout(bootstrapTimer);
    };
  }, [tenant?.id]);

  // ⭐ PRÉ-CACHE DES MODULES (navigation hors ligne) — v3.2.0 :
  //    à CHAQUE montage de l'app (plus seulement au 1er bootstrap — les
  //    utilisateurs existants n'avaient JAMAIS les modules pré-cachés, le
  //    pré-cache ne se déclenchait qu'au tout premier login du device).
  //    Auto-gardé par le service (1×/24 h — couvre les nouveaux déploiements).
  //    Retenté automatiquement au retour du réseau si pas encore fait.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      import('@/lib/offline/module-precache.service')
        .then(({ precacheAllModules }) => {
          precacheAllModules((current, total) => {
            if (current % 10 === 0 || current === total) {
              console.log(`[ModulePrecache] Progress: ${current}/${total}`);
            }
          });
        })
        .catch((err) => {
          console.warn('[ModulePrecache] Failed to start:', err);
        });
    };
    // Délai : ne pas concurrencer le bootstrap des données ni le rendu initial
    const timer = setTimeout(run, 15000);
    window.addEventListener('online', run);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', run);
    };
  }, [tenant?.id]);

  return (
    <>
    {/* ⭐ OFFLINE-FIRST RÉACTIVÉ — SW offline (Background Sync + cache API) */}
    <OfflineSWRegister />
    {/* ⭐ TAURI : AppGate remplace le middleware côté client (résolution tenant + validation session) */}
    <AppGate>
    <SessionManagerProvider>
      {/* ⭐ OfflineGuard : bannière hors-ligne + blocage écritures financières offline */}
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
          DÉSACTIVÉ pour tous les rôles sauf plateforme owner / super admin.
          L'utilisateur a demandé de masquer Sarah pour la présentation.
          Pour réactiver, retirer la condition ou passer SHOW_SARAH à true. */}
      {(() => {
        const SHOW_SARAH = false; // ⭐ Désactivé globalement pour la présentation
        const PLATFORM_ROLES = ['PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];
        const isPlatformAdmin = SHOW_SARAH && user?.role && PLATFORM_ROLES.includes(user.role);
        return isPlatformAdmin ? <InAppSaraGuideWidget /> : null;
      })()}
      {/* ⭐ OnboardingTour — parcours guidé par Sarah au premier login
          Désactivé en même temps que le widget Sarah. */}
      {/* <OnboardingTour /> */}
      {/* ⭐ Toaster (sonner) — affiche les toast.success/toast.error partout
          dans l'app (sans lui, les notifications sont silencieuses) */}
      <Toaster richColors position="top-right" closeButton />
      {/* ⭐ Badge statut réseau (en ligne / hors ligne / sync en cours) */}
      <OfflineStatusBadge />
      <PWAInstallPrompt appName={tenant?.name || 'Academia Helm'} />
      {/* ⭐ Modal de sync (progression) + résolution de conflits (finance → révision manuelle) */}
      <SyncModal />
      <ConflictResolutionModal />
    </OfflineGuard>
    </SessionManagerProvider>
    </AppGate>
    </>
  );
}
