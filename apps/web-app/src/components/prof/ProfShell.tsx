'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — SHELL DE L'ESPACE CONNECTÉ
 * ============================================================================
 *
 * Monte la pile de providers dont les workspaces pédagogiques existants ont
 * besoin (même pile que /app, en version allégée) :
 *
 *   QueryProvider → I18nProvider → AppSessionProvider → AcademicYearProvider
 *   → SchoolLevelProvider → BilingualProvider
 *
 * puis le chrome ProfLayout (header + sidebar propres au mini-SaaS).
 *
 * ⭐ v4.18.0 — OFFLINE-FIRST POUR LES ENSEIGNANTS (spécification) :
 * le portail /prof bénéficie du MÊME système hors ligne qu'Academia Helm :
 *   - Service Worker unifié (/sw.js v4.18.0) : app-shell /prof/dashboard,
 *     cache API NetworkFirst + file de mutations (outbox + Background Sync) ;
 *   - Bootstrap IDB différé (18 s) + cohérence tenant (purge cross-tenant) ;
 *   - Pré-cache des routes /prof/* (30 s, idle) puis des données API ;
 *   - UI offline : bannière OfflineGuard + toast hors ligne + SyncToast +
 *     modal de sync + résolution de conflits.
 *
 * ⭐ v4.18.0 — PORTE D'ABONNEMENT : au montage, l'état de l'abonnement est
 * vérifié ; un compte INACTIF (fin de grâce de 7 jours) est redirigé vers
 * la page de paiement (/prof/checkout?reactivate=1) — spécification Helm
 * Enseignant (2 000 FCFA / mois).
 */

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Calculator,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { QueryProvider } from '@/providers/QueryProvider';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import { BilingualProvider } from '@/contexts/BilingualContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import type { User, Tenant } from '@/types';

// ─── Offline-first (même couche que /app — cf. layout-client.tsx) ──────────
import OfflineGuard from '@/components/offline/OfflineGuard';
import { OfflineSWRegister } from '@/components/offline/OfflineSWRegister';
import NetworkRecovery from '@/components/offline/NetworkRecovery';
import { SyncToast } from '@/components/offline/SyncToast';
// Modaux rares à l'écran → import dynamique (hors chunk initial partagé).
const SyncModal = dynamic(
  () => import('@/components/offline/SyncModal').then((m) => m.SyncModal ?? m.default),
  { ssr: false },
);
const ConflictResolutionModal = dynamic(
  () =>
    import('@/components/offline/ConflictResolutionModal').then(
      (m) => m.ConflictResolutionModal ?? m.default,
    ),
  { ssr: false },
);

const NAV_ITEMS = [
  { href: '/prof/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/prof/pedagogie', label: 'Espace pédagogique', icon: BookOpen },
  { href: '/prof/travaux', label: 'Travaux & suivi', icon: ClipboardList },
  { href: '/prof/planification', label: 'Planification annuelle', icon: CalendarDays },
  { href: '/prof/examens', label: 'Évaluations & bulletins', icon: Calculator },
  { href: '/prof/eleves', label: 'Mes élèves', icon: Users },
  { href: '/prof/parametres', label: 'Paramètres', icon: Settings },
];

export interface ProfShellProps {
  children: ReactNode;
  user: User;
  tenant: Tenant;
}

export function ProfShell({ children, user, tenant }: ProfShellProps) {
  return (
    <I18nProvider>
      <QueryProvider>
        <AppSessionProvider user={user} tenant={tenant}>
          <AcademicYearProvider>
            <SchoolLevelProvider>
              <BilingualProvider>
                <ProfOfflineRoot tenantId={tenant?.id}>
                  <ProfLayout>{children}</ProfLayout>
                </ProfOfflineRoot>
              </BilingualProvider>
            </SchoolLevelProvider>
          </AcademicYearProvider>
        </AppSessionProvider>
      </QueryProvider>
    </I18nProvider>
  );
}

/**
 * Couche offline + porte d'abonnement — enveloppe le layout visuel.
 * (Hors providers métier : la redirection d'inactivation ne dépend d'aucun
 * contexte — un simple fetch authentifié au montage.)
 */
function ProfOfflineRoot({ tenantId, children }: { tenantId?: string; children: ReactNode }) {
  // ⭐ PORTE D'ABONNEMENT — compte INACTIF (fin de grâce) → page de paiement.
  //    Couvre le cas d'une session encore valide (cookie 24 h) posée AVANT
  //    l'inactivation : le login redirige déjà, ce filet rattrape les sessions
  //    déjà ouvertes. Silencieux hors ligne (le shell reste utilisable, la
  //    vérification repassera à la prochaine connexion réseau).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { apiClient } = await import('@/lib/api/client');
        const res = await apiClient.get('/teacher-portal/checkout/status', { timeout: 15000 });
        const status = String(res.data?.status ?? '').toUpperCase();
        if (!cancelled && (status === 'SUSPENDED' || status === 'BLOCKED')) {
          window.location.href = '/prof/checkout?reactivate=1';
        }
      } catch {
        /* hors ligne / token expiré — non bloquant */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ⭐ AUTO-SYNC au retour du réseau (outbox SW → replay ; même pattern /app).
  useEffect(() => {
    if (!tenantId) return;
    import('@/lib/offline/auto-sync-trigger')
      .then(({ initAutoSyncTrigger }) => initAutoSyncTrigger(tenantId))
      .catch(() => {});
  }, [tenantId]);

  // ⭐ BOOTSTRAP OFFLINE — cohérence tenant + prefetch critique + bootstrap
  //    complet différé (18 s, idle) : l'UI répond D'ABORD, le hors-ligne se
  //    prépare discrètement ensuite (pattern Task 73 du layout /app).
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: number | null = null;

    (async () => {
      try {
        const { offlineBootstrapService } = await import(
          '@/lib/offline/offline-bootstrap.service'
        );
        await offlineBootstrapService.ensureTenantCacheCoherence(tenantId);
        offlineBootstrapService
          .ensureCriticalDataPrefetched(tenantId)
          .catch((err) => console.warn('[ProfBootstrap] Critical prefetch failed:', err));
      } catch (err) {
        console.warn('[ProfBootstrap] Tenant coherence check failed:', err);
      }
      if (cancelled) return;

      const bootstrapKey = `academia_helm_bootstrapped_${tenantId}`;
      if (localStorage.getItem(bootstrapKey) === 'true') return;

      const startBootstrap = () => {
        if (cancelled) return;
        import('@/lib/offline/offline-sync.service')
          .then(({ offlineSyncService }) =>
            offlineSyncService.bootstrap(tenantId, { background: true }),
          )
          .then((ok) => {
            if (ok) localStorage.setItem(bootstrapKey, 'true');
          })
          .catch((err) => console.warn('[ProfBootstrap] Failed:', err));
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

    return () => {
      cancelled = true;
      if (bootstrapTimer) clearTimeout(bootstrapTimer);
      if (idleHandle !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [tenantId]);

  // ⭐ PRÉ-CACHE DES MODULES /prof/* (routes HTML puis données API) — même
  //    cadence que /app : 30 s + requestIdleCallback, données API 30 s plus
  //    tard. Auto-gardé 1×/24 h + à chaque activation de version du SW.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    let idleHandle: number | null = null;
    const run = () => {
      if (cancelled) return;
      import('@/lib/offline/module-precache.service')
        .then(({ precacheAllModules, initModulePrecacheInvalidation }) => {
          initModulePrecacheInvalidation();
          precacheAllModules();
          setTimeout(() => {
            if (cancelled) return;
            import('@/lib/offline/module-precache.service')
              .then(({ precacheApiData }) => precacheApiData())
              .catch(() => {});
          }, 30000);
        })
        .catch(() => {});
    };
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleHandle = (window as any).requestIdleCallback(run, { timeout: 8000 });
      } else {
        run();
      }
    }, 30000);
    const runDirect = () => run();
    window.addEventListener('online', runDirect);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (idleHandle !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      window.removeEventListener('online', runDirect);
    };
  }, [tenantId]);

  return (
    <>
      {/* SW offline (Background Sync + cache API + pont outbox→page) */}
      <OfflineSWRegister />
      {/* Retour de connexion : sonde + re-fetch des données */}
      <NetworkRecovery />
      <OfflineGuard>
        {children}
        {/* UI offline : toast sync + modal progression + conflits */}
        <SyncToast />
        <SyncModal />
        <ConflictResolutionModal />
      </OfflineGuard>
    </>
  );
}

function ProfLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, tenant } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Enseignant';

  // Ferme le menu mobile à chaque changement de route (évite le menu ouvert
  // sur un contenu étroit — propreté responsive).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort — la purge cookie côté serveur a déjà été tentée
    }
    window.location.href = '/prof/login';
  };

  const nav = (
    <nav className="space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <item.icon className={`h-4.5 w-4.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Sidebar desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-slate-900">Helm Enseignant</p>
            <p className="truncate text-xs text-slate-500">
              {tenant?.name || 'Espace personnel'}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4.5 w-4.5 text-slate-400" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Sidebar mobile ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="truncate text-sm font-bold text-slate-900">Helm Enseignant</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t border-slate-200 p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4.5 w-4.5 text-slate-400" />
                Se déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">
                {academicYear?.label || 'Année scolaire'}
                {schoolLevel?.label ? ` · ${schoolLevel.label}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
              {(user?.firstName || user?.email || 'P').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
