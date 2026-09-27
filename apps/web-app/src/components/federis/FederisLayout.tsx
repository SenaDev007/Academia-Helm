/**
 * FederisLayout - Portail Academia Federis
 * ═══════════════════════════════════════════════════════════════════════════
 * REFONTE DESIGN WinAgro-inspired (2026-09-27) — palette navy/or et police
 * Inter CONSERVÉES :
 *   - Sidebar navy nuit en dégradé (équivalent backoffice WinAgro) avec pilules
 *     de navigation, indicateur actif or et liseré lumineux
 *   - Header verre dépoli (fed-glass) sticky avec indicateur LIVE (ping),
 *     sélecteurs année/session institutionnels
 *   - Bandeau d'abonnement or, bouton mobile flottant, entrée animée (framer)
 *
 * Layout institutionnel pour l'écosystème Academia Federis.
 * Utilisé sur toutes les pages /federis/* (espace connecté).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import type { User, Tenant } from '@/types';
import OfflineIndicator from '@/components/offline/OfflineIndicator';
import OfflineGuard from '@/components/offline/OfflineGuard';
import { offlineBootstrapService } from '@/lib/offline/offline-bootstrap.service';
import { useFederisPath } from '@/lib/federis/useFederisPath';
import { apiClient } from '@/lib/api/client';
// ⭐ Miroir offline — purge à la déconnexion (données sensibles des examens)
import { federisMirror } from '@/lib/federis/federis-mirror.service';
// ⭐ UI Shells par fonction (pattern Helm admin-portal-map) : la navigation
//    est filtrée selon la fonction du membre (profil API /federis/patronat/profile
//    → userRole ; fallback User.role de la session).
import { canAccessRoute, patronatRoleLabel } from '@/lib/patronat/permissions';
// ⭐ Pattern Helm — déconnexion complète : purge localStorage + Cache API
//    (flag anti-boucle 60 s posé par clearClientSessionSync)
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
// ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service)
import ProfileDialog from '@/components/profile/ProfileDialog';
import { useUserProfileStore } from '@/stores/user-profile-store';
// ⭐ ADN WinAgro — indicateur LIVE (pastille ping)
import { FedLiveBadge } from '@/components/federis/federis-motion';

interface FederisLayoutProps {
  children: React.ReactNode;
  user: User;
  federis: Tenant;
  currentAcademicYear?: {
    id: string;
    label: string;
  };
}

// Navigation institutionnelle (cahier des charges §7.1) :
//   1. Tableau de bord  2. Patronats territoriaux (NATIONAL uniquement)
//   3. Écoles rattachées  4. Examens nationaux  5. Candidats  6. Centres et salles
//   7. Épreuves et documents  8. Banque d'épreuves  9. Rapports  10. ORION (lecture seule)
//   11. Paramètres  12. Équipe & Comptes (coordonnateur)
// « Patronats territoriaux » n'est rendu que si le profil patronat (API) indique
// orgLevel NATIONAL. Chaque entrée est en outre filtrée par la FONCTION du
// membre connecté (canAccessRoute) : le coordonnateur voit toute l'application,
// le secrétaire / trésorier / organisateur / chargé de mission voient leur
// périmètre (UI Shells — pattern Helm).
const federisNavItems = [
  {
    category: 'PILOTAGE',
    items: [
      { name: 'Tableau de bord', subPath: '/dashboard', icon: 'dashboard' as const },
    ]
  },
  {
    category: 'GOUVERNANCE',
    items: [
      { name: 'Patronats territoriaux', subPath: '/patronats', icon: 'network' as const, nationalOnly: true },
      { name: 'Bureau & Membres', subPath: '/bureau', icon: 'building' as const },
      // ⭐ Création des comptes membres — coordonnateur uniquement
      { name: 'Équipe & Comptes', subPath: '/team', icon: 'students' as const },
    ]
  },
  {
    category: 'RÉSEAU',
    items: [
      { name: 'Écoles rattachées', subPath: '/schools', icon: 'classes' as const },
    ]
  },
  {
    category: 'EXAMENS',
    items: [
      { name: 'Examens nationaux', subPath: '/exams', icon: 'exams' as const },
      { name: 'Centres et salles', subPath: '/centers', icon: 'classes' as const },
      { name: 'Candidats', subPath: '/candidates', icon: 'scolarite' as const },
      { name: 'Délibérations', subPath: '/deliberations', icon: 'document' as const },
    ]
  },
  {
    category: 'RESSOURCES',
    items: [
      { name: 'Épreuves et documents', subPath: '/documents', icon: 'document' as const },
      { name: 'Banque d\u2019épreuves', subPath: '/question-bank', icon: 'library' as const },
    ]
  },
  {
    category: 'ANALYSE',
    items: [
      { name: 'Rapports et statistiques', subPath: '/reports', icon: 'grades' as const },
      { name: 'ORION (lecture seule)', subPath: '/orion', icon: 'orion' as const },
    ]
  },
  {
    category: 'SYSTÈME',
    items: [
      { name: 'Gestion des conflits', subPath: '/conflicts', icon: 'warning' as const },
      { name: 'Paramètres', subPath: '/settings', icon: 'settings' as const },
    ]
  }
];

export default function FederisLayout({
  children,
  user,
  federis,
  currentAcademicYear,
}: FederisLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { path: federisPath } = useFederisPath();
  // ⭐ Profil patronat (API) : orgLevel (visibilité « Patronats territoriaux »)
  //    + statut d'abonnement (bandeau de blocage si impayé — cahier des charges §12.3)
  //    + fonction du membre (userRole) → UI Shell par rôle
  const [orgLevel, setOrgLevel] = useState<string | null>(null);
  const [patronatUserRole, setPatronatUserRole] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string;
    plan: string;
    expiresAt?: string | null;
  } | null>(null);
  // ⭐ « Mon profil » — dialogue photo de profil + mot de passe
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // ⭐ Photo PERSO > photo du dossier RH — même priorité que « Mon profil »
  //    (sinon la photo RH ne s'affichait que dans le modal, pas dans la topbar)
  const profileAvatarUrl = useUserProfileStore(
    (s) => s.profile?.avatarUrl ?? s.profile?.hrPhotoUrl ?? null,
  );
  const ensureProfileLoaded = useUserProfileStore((s) => s.ensureLoaded);
  useEffect(() => {
    void ensureProfileLoaded();
  }, [ensureProfileLoaded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/profile', { timeout: 20000 });
        if (!cancelled && res.data) {
          setOrgLevel(res.data.orgLevel ?? null);
          // ⭐ Fonction du membre (PatronatUser.role) — prioritaire sur User.role
          setPatronatUserRole(res.data.userRole ?? res.data.userFunction ?? null);
          setSubscription({
            status: res.data.subscription?.status ?? 'UNKNOWN',
            plan: res.data.subscription?.plan ?? 'ESSENTIEL',
            expiresAt: res.data.subscription?.expiresAt ?? null,
          });
        }
      } catch {
        // Profil indisponible (API au repos) — la navigation de base reste utilisable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ⭐ UI Shell : le rôle effectif = fonction patronat (profil API) sinon
  //    User.role de la session. Libellé métier (ex. « Coordonnateur ») en topbar.
  const effectiveRole = patronatUserRole ?? user.role ?? null;
  const roleLabel = patronatRoleLabel(effectiveRole);
  const isNational = orgLevel === 'NATIONAL';
  const subscriptionBlocked =
    subscription?.status === 'PENDING_PAYMENT' || subscription?.status === 'EXPIRED';

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <OfflineGuard>
      <div className="min-h-screen bg-[#f7f9fc] fed-app">
        {/* ── HEADER VERRE (ADN WinAgro : glass + LIVE) ─────────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-40 fed-glass shadow-md">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="fed-logo-beam w-11 h-11 flex items-center justify-center p-0.5 shadow-md">
                <Image
                  src="/images/logo-Academia Hub.webp"
                  alt="Academia Federis"
                  width={38}
                  height={38}
                  className="h-9 w-9 object-contain rounded-full"
                  priority
                />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-black text-[#0b1d3a] tracking-wide">FEDERIS</div>
                <div className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-widest">
                  {federis.name}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 sm:space-x-6">
              {/* Indicateur LIVE (ADN backoffice WinAgro) */}
              <div className="hidden lg:block">
                <FedLiveBadge label="SESSION ACTIVE" />
              </div>

              <div className="hidden md:flex flex-col items-end mr-2 border-r border-blue-100 pr-6">
                 <div className="flex items-center space-x-2 mb-1">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Année Scolaire</span>
                   <select className="bg-[#eff6ff] border border-blue-100 text-xs font-black text-[#0b1d3a] rounded-lg px-2 py-1 outline-none focus:border-[#1e3a8a] transition-colors">
                     <option value="2026-2027">{currentAcademicYear?.label ?? '2026 - 2027'} (Active)</option>
                   </select>
                 </div>
                 <div className="flex items-center space-x-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Période/Session</span>
                   <select className="bg-white border border-blue-100 text-xs font-bold text-slate-600 rounded-lg px-2 py-0.5 outline-none focus:border-[#1e3a8a] transition-colors">
                     <option value="session-annuelle">Session Annuelle Principale</option>
                   </select>
                 </div>
              </div>

              <button className="p-2 text-slate-500 hover:text-[#0b1d3a] hover:bg-[#eff6ff] rounded-full transition-colors relative">
                <AppIcon name="bell" size="menu" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-white animate-ping" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-bold text-[#0b1d3a]">{user.firstName} {user.lastName}</div>
                  {/* ⭐ Fonction patronat lisible (Coordonnateur, Secrétaire…) */}
                  <div className="text-xs font-bold text-[#1e3a8a]">{roleLabel}</div>
                </div>
                {/* ⭐ Avatar — cliquable : ouvre « Mon profil » (photo + mot de passe) */}
                <button
                  type="button"
                  onClick={() => setProfileDialogOpen(true)}
                  className="rounded-full transition-transform hover:scale-105"
                  title="Mon profil — photo de profil et mot de passe"
                >
                  {profileAvatarUrl ? (
                    <img
                      src={profileAvatarUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-8 h-8 rounded-full object-cover border-2 border-amber-400/60"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-full flex items-center justify-center ring-2 ring-amber-400/40">
                      <span className="text-white text-sm font-bold">
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </button>
                {/* Logout Button (Section 20.2) — pattern Helm :
                    1) révocation JWT + purge des cookies (BFF /api/auth/logout)
                    2) clearClientSessionSync : localStorage + Cache API + flag
                       anti-boucle (la page login saute la détection de session
                       pendant 60 s) 3) purge du cache offline + miroir Federis
                       4) redirection */}
                <button
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(
                      () => undefined,
                    );
                    clearClientSessionSync();
                    await offlineBootstrapService.clearCache();
                    // ⭐ Miroir Federis : purge des données sensibles (examens,
                    //    candidats, résultats) à la déconnexion
                    await federisMirror.clearAll().catch(() => undefined);
                    window.location.href = federisPath('/login');
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Déconnexion sécurisée (Efface le cache offline et le miroir)"
                >
                  <AppIcon name="logout" size="menu" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex pt-16">
          {/* ── SIDEBAR NAVY NUIT (ADN backoffice WinAgro) ──────────────────── */}
          <aside className={cn(
            'fixed left-0 top-16 bottom-0 w-64 bg-gradient-to-b from-[#0b1d3a] via-[#0b1d3a] to-[#071528] border-r border-blue-400/10 transition-transform duration-300 z-30',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0'
          )}>
            {/* Grain décoratif */}
            <div className="absolute inset-0 fed-grain-light opacity-[0.05] pointer-events-none" />
            {/* Liseré lumineux supérieur */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

            <nav className="h-full overflow-y-auto py-6 relative z-10 fed-scroll">
              {federisNavItems.map((group) => {
                // « Patronats territoriaux » : NATIONAL uniquement (§7.1) ;
                // chaque entrée est filtrée par la fonction du membre (UI Shell).
                const visibleItems = group.items.filter(
                  (item) =>
                    (!('nationalOnly' in item) || !item.nationalOnly || isNational) &&
                    canAccessRoute(effectiveRole, item.subPath),
                );
                if (visibleItems.length === 0) return null;
                return (
                <div key={group.category} className="mb-6">
                  <h3 className="px-6 text-[10px] font-black text-blue-200/40 uppercase tracking-[0.2em] mb-2.5">
                    {group.category}
                  </h3>
                  <div className="px-3 space-y-1">
                    {visibleItems.map((item) => {
                      const itemHref = federisPath(item.subPath);
                      const active = isActive(itemHref);
                      return (
                      <Link
                        key={item.subPath}
                        href={itemHref}
                        className={cn(
                          'group relative flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                          active
                            ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 shadow-md'
                            : 'text-blue-100/60 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        {/* Liseré actif or (ADN WinAgro) */}
                        {active && (
                          <motion.span
                            layoutId="fed-nav-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-gradient-to-b from-[#fbbf24] to-[#f59e0b]"
                          />
                        )}
                        <AppIcon
                          name={item.icon}
                          size="menu"
                          className={cn(
                            'transition-colors',
                            active ? 'text-amber-400' : 'text-blue-200/50 group-hover:text-amber-300/80',
                          )}
                        />
                        <span>{item.name}</span>
                      </Link>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </nav>
          </aside>

          <main className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-0')}>
            <div className="p-6 lg:p-8">
              {/* Bandeau abonnement (cahier des charges §12.3 — blocage si impayé,
                  les archives restent consultables depuis les rapports) */}
              <AnimatePresence>
                {subscriptionBlocked && (
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-2xl px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <AppIcon name="warning" size="menu" className="text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-black text-amber-900">
                          {subscription?.status === 'EXPIRED'
                            ? 'Abonnement expiré — accès restreint'
                            : 'Activation requise — accès restreint'}
                        </p>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Activez votre abonnement {subscription?.plan === 'INSTITUTION' ? 'Institution' : 'Essentiel'} pour
                          retrouver l&rsquo;ensemble des fonctions. Les données officielles déjà publiées restent
                          consultables depuis les rapports.
                        </p>
                      </div>
                    </div>
                    <Link
                      href={federisPath('/checkout')}
                      className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0b1d3a] rounded-full font-black text-sm hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all fed-btn-shimmer"
                    >
                      {subscription?.status === 'EXPIRED' ? 'Renouveler' : 'Activer maintenant'}
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
              {children}
            </div>
          </main>
        </div>

        {/* Bouton menu mobile flottant (ADN WinAgro — pilule or) */}
        <motion.button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          whileTap={{ scale: 0.92 }}
          className="fixed bottom-4 left-4 z-50 lg:hidden p-3 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] text-amber-400 rounded-full shadow-xl border border-blue-400/20"
        >
          <AppIcon name={sidebarOpen ? 'close' : 'menu'} size="menu" />
        </motion.button>

        <OfflineIndicator />

        {/* ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service) */}
        <ProfileDialog
          open={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          fallbackUser={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: roleLabel,
          }}
        />
      </div>
    </OfflineGuard>
  );
}
