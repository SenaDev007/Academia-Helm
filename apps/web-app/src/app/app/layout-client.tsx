/**
 * App Layout Client Component
 * 
 * Composant client pour gérer le flow post-login
 * Wrapper autour du layout serveur
 */

'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
import type { User, Tenant } from '@/types';
import { ReviewPromptHost } from '@/components/reviews/ReviewPromptHost';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';
import { TenantThemeProvider } from '@/providers/TenantThemeProvider';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { Toaster } from '@/components/ui/sonner';
// ⭐ PERF (chantier GTMetrix) — composants rares à l'écran (modaux de session,
//    chat tiers, modal de sync) en import dynamique : hors du chunk initial
//    partagé par TOUTES les vues /app/*.
//    - SessionInactivityModal / SessionLockScreen / SyncModal tiraient
//      framer-motion (~35 Ko gz) dans le chunk partagé de chaque rôle.
//    - CrispChat injecte un script tiers : différé aussi côté import.
const SessionInactivityModal = dynamic(
  () => import('@/components/auth/SessionInactivityModal').then((m) => m.default ?? m.SessionInactivityModal ?? m),
  { ssr: false },
);
const SessionLockScreen = dynamic(
  () => import('@/components/auth/SessionLockScreen').then((m) => m.default ?? m.SessionLockScreen ?? m),
  { ssr: false },
);
const CrispChat = dynamic(
  () => import('@/components/CrispChat').then((m) => m.CrispChat ?? m.default),
  { ssr: false },
);
const SyncModal = dynamic(
  () => import('@/components/offline/SyncModal').then((m) => m.SyncModal ?? m.default),
  { ssr: false },
);
// ⭐ Sarah Guide In-App — DÉSACTIVÉ (présentation) : imports statiques retirés
//    du chunk partagé (jamais rendus, SHOW_SARAH=false). Réactivation : import
//    dynamique dans la condition ci-dessous, ex.
//    const InAppSaraGuideWidget = dynamic(() => import('@/components/ai/InAppSaraGuideWidget'), { ssr: false });
// ⭐ Offline-first : bannière hors ligne + prompt d'installation PWA + SW offline + modal sync
//    (badge statut réseau retiré du layout — cf. commentaire dans le rendu)
// ⭐ RÉACTIVÉ (sept. 2026) — spécification « mode hors-ligne offline-first » :
//    lecture intégrale hors ligne + file de mutations + sync auto au retour réseau.
import OfflineGuard from '@/components/offline/OfflineGuard';
import { OfflineSWRegister } from '@/components/offline/OfflineSWRegister';
// ⭐ (sept. 2026 — retour promoteur « l'application ne recharge plus au
//    retour de la connexion ») : sonde de connectivité au retour réseau →
//    événement 'ah:network-restored' (re-fetch features/contexte/identité)
//    + rechargement propre unique si l'app est dégradée (navigation
//    hors ligne échouée).
import NetworkRecovery from '@/components/offline/NetworkRecovery';
import AppGate from '@/components/auth/AppGate';
import { ConflictResolutionModal } from '@/components/offline/ConflictResolutionModal';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { DeferredRoutePrefetch } from '@/components/perf/DeferredRoutePrefetch';
// ⭐ NATIVE SESSION RESUME : mémorise l'hôte tenant courant (cookie partagé
//    .academiahelm.com) pour que le démarrage à froid de l'app Android
//    retourne directement à l'interface au lieu du portail public.
import { isNativeApp } from '@/lib/pwa/is-native-app';
import { writeNativeResumeHint } from '@/lib/auth/native-session-resume';

// ⭐ V4.0 (rollback de l'approche dataService) : plus AUCUNE installation
//    d'intercepteur offline au niveau applicatif — les fetchs des composants
//    restent NATIFS et l'interception (lecture + écriture) vit entièrement
//    dans le Service Worker (sw.js v4). L'installation précoce module-level
//    (v3.9) routait les premiers fetchs post-login vers la couche
//    applicative — retirée. Le SW contrôle toutes les requêtes dès
//    l'enregistrement (clients.claim) — y compris académique années/niveaux.

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
  // ⭐ PERF (chantier GTMetrix) — fade d'apparition en CSS pur (globals.css
  //    .app-fade-in) : remplace motion.div + getFadeMotion (framer-motion
  //    ~35 Ko gz retirés du chunk partagé de toutes les vues /app/*).

  // Abonnement Web Push (notifications navigateur, même onglet fermé)
  // Actif seulement si VAPID configuré côté backend + permission utilisateur granted
  const { status: pushStatus } = usePushSubscription(true);
  void pushStatus;

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

  // ⭐ NATIVE SESSION RESUME — app Android (Capacitor) : au montage du shell
  //    authentifié, mémoriser l'hôte tenant courant. Couvre AUSSI les sessions
  //    établies AVANT le déploiement de ce correctif (l'utilisateur ouvre /app
  //    une fois → le hint est posé → les prochains démarrages à froid
  //    reprennent directement la session). No-op hors coquille native.
  useEffect(() => {
    if (isNativeApp()) writeNativeResumeHint();
  }, []);

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

  // ⭐ OFFLINE-FIRST (v4.0 — interception Service Worker) :
  //    auto-sync + bootstrap IDB + précache modules. L'interception des
  //    requêtes vit dans le SW (sw.js v4) en WEB ; window.fetch n'est patché
  //    QUE dans la webview TAURI (pas de SW là-bas) — l'appel ci-dessous est
  //    un NO-OP en navigateur web (cf. global-fetch-interceptor.ts).

  // ⭐ TAURI : installer l'intercepteur SQLite (no-op en web — le SW
  //    intercepte tout). Idempotent, dynamique (chunk non critique).
  useEffect(() => {
    import('@/lib/offline/global-fetch-interceptor').then(({ installGlobalFetchInterceptor }) => {
      installGlobalFetchInterceptor();
    }).catch(() => {});
  }, []);

  // ⭐ AUTO-SYNC : déclencher push+pull automatiquement au retour du réseau
  //    (les événements outbox créés PAR LE SW portent metadata.sw → le
  //    sync-engine applicatif les IGNORE et laisse le replay au SW :
  //    propriétaire unique, aucun doublon de mutation rejouée.)
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
  //    ⭐ Task 73 (2026-09-17 — lenteurs UI admin) : le bootstrap de DONNÉES est
  //    désormais (a) DIFFÉRÉ jusqu'à ce que l'app soit utilisable (idle navigateur
  //    + délai minimum 18 s — avant : 5 s, pile quand le sélecteur de niveau, les
  //    contextes et les dashboards chargent → saturation de la bande passante
  //    sur connexion école → « tout est lent ») et (b) NON BLOQUANT (modal
  //    minimisé d'office : petite pastille au lieu de l'overlay plein écran
  //    « Téléchargement initial des données de l'école… »). Pattern promoteur :
  //    l'UI répond D'ABORD, le hors-ligne se prépare discrètement ensuite.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: number | null = null;

    (async () => {
      // 1. Cohérence tenant du cache local (lecture légère IDB ; purge si autre école)
      try {
        const { offlineBootstrapService } = await import('@/lib/offline/offline-bootstrap.service');
        await offlineBootstrapService.ensureTenantCacheCoherence(tenant.id);
        // ⭐ v3.5.0 — prefetch critique CORRIGÉ (stores singuliers) pour les
        //    appareils déjà bootstrappés avec l'ancien code (IDB vide) —
        //    guard versionné, s'exécute UNE fois par tenant puis flag.
        offlineBootstrapService
          .ensureCriticalDataPrefetched(tenant.id)
          .catch((err) => console.warn('[Bootstrap] Critical data prefetch v2 failed:', err));
      } catch (err) {
        console.warn('[Bootstrap] Tenant coherence check failed:', err);
      }
      if (cancelled) return;

      // 2. Bootstrap si pas encore fait pour CE tenant
      const bootstrapKey = `academia_helm_bootstrapped_${tenant.id}`;
      if (localStorage.getItem(bootstrapKey) === 'true') return;

      // ⭐ Task 73 — planification idle : minimum 18 s PUIS créneau libre du
      //    navigateur (requestIdleCallback, fallback setTimeout). Le téléchargement
      //    massif (tables de sync) ne concurrence plus le premier rendu.
      const startBootstrap = () => {
        if (cancelled) return;
        import('@/lib/offline/offline-sync.service').then(({ offlineSyncService }) => {
          // ⭐ Flag posé SEULEMENT après un bootstrap réussi (sinon retry au prochain mount)
          // ⭐ background: true → modal minimisé (pastille), jamais d'overlay bloquant
          offlineSyncService.bootstrap(tenant.id, { background: true }).then((ok) => {
            if (ok) {
              localStorage.setItem(bootstrapKey, 'true');
            } else {
              console.warn('[Bootstrap] Échec — le bootstrap sera retenté au prochain chargement');
            }
          });
        }).catch((err) => {
          console.warn('[Bootstrap] Failed to import offline-sync.service:', err);
        });
      };

      bootstrapTimer = setTimeout(() => {
        if (cancelled) return;
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          idleHandle = (window as any).requestIdleCallback(startBootstrap, { timeout: 8000 });
        } else {
          startBootstrap();
        }
      }, 18000);
    })();

    // Cleanup : annule le flag ET les timers de bootstrap (IIFE async)
    return () => {
      cancelled = true;
      if (bootstrapTimer) clearTimeout(bootstrapTimer);
      if (idleHandle !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [tenant?.id]);

  // ⭐ PRÉ-CACHE DES MODULES (navigation hors ligne) — v3.2.0 :
  //    à CHAQUE montage de l'app (plus seulement au 1er bootstrap — les
  //    utilisateurs existants n'avaient JAMAIS les modules pré-cachés, le
  //    pré-cache ne se déclenchait qu'au tout premier login du device).
  //    Auto-gardé par le service (1×/24 h — couvre les nouveaux déploiements).
  //    Retenté automatiquement au retour du réseau si pas encore fait.
  //    ⭐ v3.3.1 : le garde 24 h est désormais sensible à la VERSION du SW
  //    (les caches ah-pages-* sont purgés à chaque bump) + écoute des
  //    activations SW (SW_ACTIVATED) pour invalider le flag immédiatement.
  //    ⭐ v3.5.0 : + PRÉ-CACHE DES DONNÉES API (KPIs de tous les dashboards) —
  //    hors ligne, les modules affichent les VRAIES données sans visite
  //    préalable en ligne (exigence offline-first, retour terrain sept. 2026).
  //    ⭐ Task 73 (2026-09-17) : le délai 15 s est désormais couplé à
  //    requestIdleCallback — le pré-cache ne démarre que si le navigateur est
  //    réellement inactif (sinon il attend un créneau, timeout 8 s). Sur
  //    connexion école lente, les 112 routes ne volent plus la bande passante
  //    des requêtes encore en cours (sélecteur niveau, KPIs dashboards).
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    let idleHandle: number | null = null;
    const run = () => {
      if (cancelled) return;
      import('@/lib/offline/module-precache.service')
        .then(({ precacheAllModules, initModulePrecacheInvalidation }) => {
          // Écouter les futures activations de versions du SW (idempotent)
          initModulePrecacheInvalidation();
          precacheAllModules((current, total) => {
            if (current % 10 === 0 || current === total) {
              console.log(`[ModulePrecache] Progress: ${current}/${total}`);
            }
          });
          // ⭐ v4.9.0 (2026-09-30 — fix « chargements > 30 s ») — données KPI
          //    des dashboards, 30 s APRÈS le début du pré-cache des routes
          //    (au lieu de 5 s) : les ~230 endpoints de fond ne doivent
          //    concurrencer NI le bootstrap des données NI le pré-cache des
          //    routes. Le SW v4.9.0 céde de toute façon la priorité aux
          //    requêtes visibles (waitForIdlePageTraffic) — ce délai limite
          //    la superposition des DEUX tempêtes de fond.
          setTimeout(() => {
            if (cancelled) return;
            import('@/lib/offline/module-precache.service')
              .then(({ precacheApiData }) => precacheApiData())
              .catch((err) => console.warn('[ApiPrecache] Failed to start:', err));
          }, 30000);
        })
        .catch((err) => {
          console.warn('[ModulePrecache] Failed to start:', err);
        });
    };
    // Délai : ne pas concurrencer le bootstrap des données ni le rendu initial
    // ⭐ v4.9.0 (2026-09-30) — 15 s → 30 s : le bootstrap post-login (année
    //    scolaire, sélecteurs, KPIs, données modules) doit être TERMINÉ avant
    //    que la tempête de fond (112 routes HTML) ne démarre — le SW céde
    //    désormais la priorité aux requêtes visibles, ce délai réduit en plus
    //    la superposition des deux pré-caches (routes puis API).
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleHandle = (window as any).requestIdleCallback(run, { timeout: 8000 });
      } else {
        run();
      }
    }, 30000);
    const runDirect = () => {
      // Retour de réseau : lancement direct (cas hors-ligne → online, l'UI est déjà prête)
      run();
    };
    window.addEventListener('online', runDirect);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (idleHandle !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      window.removeEventListener('online', runDirect);
    };
  }, [tenant?.id]);

  return (
    <>
    {/* ⭐ OFFLINE-FIRST RÉACTIVÉ — SW offline (Background Sync + cache API) */}
    <OfflineSWRegister />
    {/* ⭐ RETOUR DE CONNEXION — sonde de connectivité réelle (debounce
        2,5 s + GET /api/auth/me) → 'ah:network-restored' (re-fetch des
        données à fetch classique) + rechargement propre UNIQUE si une
        navigation hors ligne a échoué (app dégradée). Monté dans le layout
        /app : c'est là que vivent les données métier. */}
    <NetworkRecovery />
    {/* ⭐ TAURI : AppGate remplace le middleware côté client (résolution tenant + validation session) */}
    <AppGate>
    <SessionManagerProvider>
      {/* ⭐ OfflineGuard : bannière hors-ligne + blocage écritures financières offline */}
      <OfflineGuard>
      <div className="app-fade-in">
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
      </div>

      {/* ⭐ PERF (chantier GTMetrix) — préchargement différé des top-modules du
          rôle APRÈS le rendu initial (idle) : les <Link> des sidebars ont
          prefetch={false} → 0 chunk module téléchargé au 1er écran, mais les
          modules les plus utilisés du rôle sont chauds en arrière-plan. */}
      <DeferredRoutePrefetch role={user?.role} />

      {/* Modaux et écrans de session — montés hors du layout principal.
          ⭐ Perf : chargés à la demande (dynamic ssr:false). */}
      <SessionInactivityModal />
      <SessionLockScreen />
      <CrispChat />
      {/* ⭐ Sarah Guide In-App — DÉSACTIVÉ globalement (présentation).
          Imports statiques retirés du chunk partagé (perf) — voir commentaire
          d'import ci-dessus pour la réactivation. */}
      {(() => {
        const SHOW_SARAH = false;
        const PLATFORM_ROLES = ['PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];
        const isPlatformAdmin = SHOW_SARAH && user?.role && PLATFORM_ROLES.includes(user.role);
        return isPlatformAdmin ? null : null;
      })()}
      {/* ⭐ OnboardingTour — désactivé (import retiré du bundle, perf) */}
      {/* ⭐ Toaster (sonner) — affiche les toast.success/toast.error partout
          dans l'app (sans lui, les notifications sont silencieuses) */}
      <Toaster richColors position="top-right" closeButton />
      {/* ⭐ Badge statut réseau SUPPRIMÉ (2026-09-13) : rendu sans positionnement,
          il apparaissait sous le footer de l'app (retour utilisateur). Le statut
          hors ligne reste visible via la bannière OfflineGuard + SyncModal. */}
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
