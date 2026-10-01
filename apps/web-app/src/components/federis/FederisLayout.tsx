/**
 * FederisLayout - Portail Academia Federis
 * ═══════════════════════════════════════════════════════════════════════════
 * ALIGNEMENT DESIGN ACADEMIA HELM (2026-09-29) — interfaces simples et
 * professionnelles, identiques à l'application Academia Helm :
 *   - Header applicatif blanc OPAQUE avec ligne dorée en haut et bordure
 *     inférieure (pattern PilotageTopBar) — CORRIGE le bug du header
 *     transparent au scroll dans les modules
 *   - Sidebar navy unie (bg-blue-900) avec indicateur actif doré, icônes
 *     gold-400 à l'état actif (pattern PilotageSidebar)
 *   - Bandeau d'abonnement sobre, bouton mobile simple
 *
 * Layout institutionnel pour l'écosystème Academia Federis.
 * Utilisé sur toutes les pages /federis/* (espace connecté).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
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
// ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (départements + lecture seule)
import { FederisScopeProvider } from '@/lib/federis/scope-context';
import FederisScopeBar from '@/components/federis/FederisScopeBar';

interface FederisLayoutProps {
  children: React.ReactNode;
  user: User;
  federis: Tenant;
  currentAcademicYear?: {
    id: string;
    label: string;
  };
  /** ⭐ Layout partagé (2026-10-01) : profil patronat chargé CÔTÉ SERVEUR par
   *  le layout (connected) — amorce orgLevel / fonction / logo / abonnement
   *  sans attendre le fetch client (qui reste en rafraîchissement arrière-plan,
   *  une seule fois par montage du layout et non plus à chaque navigation). */
  initialProfile?: {
    orgLevel: string | null;
    userRole: string | null;
    logo: string | null;
    name?: string;
    subscription: {
      status: string;
      plan: string;
      expiresAt?: string | null;
    } | null;
  } | null;
}

// Navigation institutionnelle (cahier des charges §7.1) :
//   1. Tableau de bord  2. Patronats territoriaux (NATIONAL uniquement)
//   3. Écoles rattachées  4. Examens nationaux  5. Centres, salles & Surveillants
//   6. Candidats  7. Épreuves et documents (catégorie EXAMENS, après Candidats)
//   8. Délibérations  9. Banque d'épreuves (+ catalogue)  10. Rapports
//   11. Paramètres  12. Équipe & Comptes (coordonnateur)
// ⭐ 2026-10-01 — modules « ORION » et « Gestion des conflits » SUPPRIMÉS
//    de l'espace Federis (demande produit).
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
      // ⭐ 2026-09-29 — module « Matières » en PREMIÈRE POSITION du périmètre
      //    EXAMENS : catalogue des matières à examiner (CEP/BEPC/BAC par
      //    série/CAP, coefficients et barèmes) — alimente le lancement des
      //    campagnes, la préparation des épreuves et la saisie des notes
      { name: 'Matières', subPath: '/subjects', icon: 'bookOpen' as const },
      { name: 'Examens nationaux', subPath: '/exams', icon: 'exams' as const },
      // ⭐ 2026-09-29 — le module couvre centres, salles ET surveillants
      //    (sous-onglet « Gestion des surveillants » : demandes aux écoles,
      //    répartition par centre et par salle, registre des affectations)
      { name: 'Centres, salles & Surveillants', subPath: '/centers', icon: 'classes' as const },
      { name: 'Candidats', subPath: '/candidates', icon: 'scolarite' as const },
      // ⭐ 2026-09-29 — « Épreuves et documents » rattaché au périmètre EXAMENS,
      //    juste après « Candidats » (le module ne contient plus que les épreuves ;
      //    le catalogue vit désormais dans la Banque d'épreuves)
      { name: 'Épreuves et documents', subPath: '/documents', icon: 'document' as const },
      // ⭐ 2026-09-29 — module « Notes et Moyennes » (avant la délibération) :
      //    saisie des notes (primaire CEP / secondaire avec coefficients)
      //    et registre des notes — reproduit le module Examen d'Academia Helm.
      //    ⭐ 2026-10-01 : les RELEVÉS DE NOTES vivent désormais dans le module
      //    Délibération (leur envoi exige une délibération préalable)
      { name: 'Notes et moyennes', subPath: '/grades', icon: 'grades' as const },
      // ⭐ 2026-10-01 — UI dédiée des secrétaires de saisie (comptes
      //    provisoires créés à l'affectation SECRÉTARIAT) — filtrée par
      //    canAccessRoute : visible UNIQUEMENT pour la fonction SAISIE_NOTES.
      { name: 'Saisie des notes', subPath: '/saisie', icon: 'grades' as const },
      // ⭐ 2026-10-01 — le module couvre la délibération du jury ET les relevés
      //    de notes (sous-onglets de chaque type d'examen CEP/BEPC/BAC/CAP) :
      //    l'envoi des relevés exige que la délibération ait été lancée
      { name: 'Délibération & relevés', subPath: '/deliberations', icon: 'document' as const },
    ]
  },
  {
    category: 'RESSOURCES',
    items: [
      { name: 'Banque d\u2019épreuves', subPath: '/question-bank', icon: 'library' as const },
    ]
  },
  {
    category: 'ANALYSE',
    items: [
      { name: 'Rapports et statistiques', subPath: '/reports', icon: 'grades' as const },
      // ⭐ 2026-10-01 — Module Archives : dossiers par année scolaire (fin
      //    d'année) — consultation module par module des années passées.
      { name: 'Archives', subPath: '/archives', icon: 'library' as const },
    ]
  },
  {
    category: 'SYSTÈME',
    items: [
      { name: 'Paramètres', subPath: '/settings', icon: 'settings' as const },
    ]
  }
];

export default function FederisLayout({
  children,
  user,
  federis,
  currentAcademicYear,
  initialProfile = null,
}: FederisLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { path: federisPath } = useFederisPath();
  // ⭐ Profil patronat (API) : orgLevel (visibilité « Patronats territoriaux »)
  //    + statut d'abonnement (bandeau de blocage si impayé — cahier des charges §12.3)
  //    + fonction du membre (userRole) → UI Shell par rôle
  //    + logo configuré (Paramètres → Identité) → en-tête de l'application
  //    ⭐ 2026-10-01 : le layout partagé passe le profil chargé côté serveur
  //    (initialProfile) — les états démarrent déjà remplis (zéro flash), le
  //    fetch client ne sert plus qu'au rafraîchissement arrière-plan.
  const [orgLevel, setOrgLevel] = useState<string | null>(initialProfile?.orgLevel ?? null);
  const [patronatUserRole, setPatronatUserRole] = useState<string | null>(
    initialProfile?.userRole ?? null,
  );
  const [patronatLogo, setPatronatLogo] = useState<string | null>(initialProfile?.logo ?? null);
  const [subscription, setSubscription] = useState<{
    status: string;
    plan: string;
    expiresAt?: string | null;
  } | null>(
    initialProfile?.subscription ?? null,
  );
  // ⭐ Nom du patronat : le profil serveur (initialProfile) prime sur le prop
  //    statique — le libellé de l'en-tête est correct dès le premier rendu,
  //    même quand la page n'a pas rechargé le profil elle-même.
  const [patronatName, setPatronatName] = useState<string | null>(
    initialProfile?.name ?? null,
  );
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

  // ⭐ Rafraîchissement arrière-plan du profil (une fois par MONTAGE du layout
  //    — le layout persiste entre modules, donc plus un appel par navigation).
  //    Si le profil serveur (initialProfile) est déjà complet, seul le logo et
  //    la fonction peuvent évoluer : le fetch reste utile comme rafraîchissement.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/profile', { timeout: 20000 });
        if (!cancelled && res.data) {
          setOrgLevel(res.data.orgLevel ?? null);
          // ⭐ Fonction du membre (PatronatUser.role) — prioritaire sur User.role
          setPatronatUserRole(res.data.userRole ?? res.data.userFunction ?? null);
          // ⭐ Logo personnalisé du patronat (configuré dans Paramètres → Identité)
          setPatronatLogo(res.data.logo ?? null);
          if (res.data.name) setPatronatName(res.data.name);
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
  // User.role de la session. Libellé métier (ex. « Coordonnateur ») en topbar.
  const effectiveRole = patronatUserRole ?? user.role ?? null;
  const roleLabel = patronatRoleLabel(effectiveRole);
  const isNational = orgLevel === 'NATIONAL';
  const subscriptionBlocked =
    subscription?.status === 'PENDING_PAYMENT' || subscription?.status === 'EXPIRED';

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <FederisScopeProvider isNational={isNational}>
    <OfflineGuard>
      <div className="min-h-screen bg-[#f7f9fc] fed-app">
        {/* ── HEADER APPLICATIF — pattern PilotageTopBar Helm ────────────────
            Blanc OPAQUE + ligne dorée en haut + bordure inférieure :
            plus aucune transparence au scroll (bug corrigé). */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-white">
          {/* Ligne dorée institutionnelle (pattern Helm) */}
          <div className="h-[2px] bg-gradient-to-r from-blue-900 via-gold-500 to-blue-900" />

          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 border-b border-gray-200">
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="relative">
                {patronatLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={patronatLogo}
                    alt={federis.name}
                    className="h-9 w-9 object-cover rounded-xl ring-1 ring-gray-100"
                  />
                ) : (
                  <Image
                    src="/images/logo-Academia Hub.webp"
                    alt="Academia Federis"
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain rounded-xl ring-1 ring-gray-100 bg-white"
                    priority
                  />
                )}
                {/* Point de statut en ligne (pattern Helm) */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[13px] font-bold text-blue-900 leading-tight">Academia Federis</div>
                <div className="text-[11px] text-gray-400 font-medium leading-tight max-w-[220px] truncate">
                  {patronatName ?? federis.name}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Sélecteurs de contexte institutionnels (pattern Helm) */}
              <div className="hidden md:flex flex-col items-end gap-1 border-r border-gray-200 pr-4">
                 <div className="flex items-center space-x-2">
                   <span className="text-[10px] font-medium text-gray-400">Année scolaire</span>
                   <select className="bg-white border border-gray-300 text-xs font-medium text-gray-700 rounded-lg px-2 py-1 outline-none focus:border-blue-600 transition-colors">
                     <option value="2026-2027">{currentAcademicYear?.label ?? '2026 - 2027'} (Active)</option>
                   </select>
                 </div>
                 <div className="flex items-center space-x-2">
                   <span className="text-[10px] font-medium text-gray-400">Période/Session</span>
                   <select className="bg-white border border-gray-300 text-xs font-medium text-gray-700 rounded-lg px-2 py-1 outline-none focus:border-blue-600 transition-colors">
                     <option value="session-annuelle">Session Annuelle Principale</option>
                   </select>
                 </div>
              </div>

              <button className="p-2 text-gray-500 hover:text-blue-900 hover:bg-gray-50 rounded-lg transition-colors relative">
                <AppIcon name="bell" size="menu" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                    {user.firstName} {user.lastName}
                  </div>
                  {/* ⭐ Fonction patronat lisible (Coordonnateur, Secrétaire…) */}
                  <div className="text-[11px] text-gray-400 font-medium">{roleLabel}</div>
                </div>
                {/* ⭐ Avatar — cliquable : ouvre « Mon profil » (photo + mot de passe) */}
                <button
                  type="button"
                  onClick={() => setProfileDialogOpen(true)}
                  className="rounded-xl transition-colors hover:ring-2 hover:ring-blue-100"
                  title="Mon profil — photo de profil et mot de passe"
                >
                  {profileAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileAvatarUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-9 h-9 rounded-xl object-cover ring-1 ring-blue-700/20"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center ring-1 ring-blue-700/20">
                      <span className="text-white text-sm font-semibold">
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
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Déconnexion sécurisée (Efface le cache offline et le miroir)"
                >
                  <AppIcon name="logout" size="menu" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex pt-[60px]">
          {/* ── SIDEBAR — pattern PilotageSidebar Helm (navy uni + or) ─────── */}
          <aside className={cn(
            'fixed left-0 top-[60px] bottom-0 w-64 bg-blue-900 border-r border-blue-950/40 transition-transform duration-300 z-30',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0'
          )}>
            <nav className="h-full overflow-y-auto py-4 relative z-10 fed-scroll">
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
                <div key={group.category} className="mb-5">
                  <h3 className="px-6 text-[10px] font-semibold text-blue-200/80 uppercase tracking-[0.15em] mb-2">
                    {group.category}
                  </h3>
                  <div className="px-3 space-y-0.5">
                    {visibleItems.map((item) => {
                      const itemHref = federisPath(item.subPath);
                      const active = isActive(itemHref);
                      return (
                      <Link
                        key={item.subPath}
                        href={itemHref}
                        className={cn(
                          'group relative flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                          active
                            ? 'bg-white/[0.12] text-white shadow-lg shadow-black/10'
                            : 'text-blue-200/80 hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        {/* Indicateur actif doré (pattern Helm) */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-gold-400 to-gold-600" />
                        )}
                        <AppIcon
                          name={item.icon}
                          size="menu"
                          className={cn(
                            'transition-colors flex-shrink-0',
                            active
                              ? 'text-gold-400'
                              : 'text-blue-300/70 group-hover:text-blue-100',
                          )}
                        />
                        <span className={cn(
                          'text-[13px] whitespace-nowrap overflow-hidden text-ellipsis',
                          active ? 'font-semibold text-white' : 'font-medium',
                        )}>
                          {item.name}
                        </span>
                      </Link>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </nav>
          </aside>

          {/* ⭐ min-w-0 OBLIGATOIRE (fix responsive 2026-09-30) : sans lui, un
              enfant flex garde min-width:auto — un tableau large (libellés sur
              une seule ligne) poussait TOUTE la page au-delà du viewport :
              tableau coupé au bord droit, bouton « Créer un examen » exilé
              hors écran. Avec min-w-0, la largeur de la zone de contenu est
              contrainte et le défilement horizontal a lieu DANS la carte
              (overflow-x-auto des tableaux) — mobile compris. */}
          <main className={cn('flex-1 min-w-0 transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-0')}>
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
              {/* Bandeau abonnement (cahier des charges §12.3 — blocage si impayé,
                  les archives restent consultables depuis les rapports) */}
              <AnimatePresence>
                {subscriptionBlocked && (
                  <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <div className="flex items-start gap-3">
                      <AppIcon name="warning" size="menu" className="text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
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
                      className="flex-shrink-0 px-4 py-2 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors"
                    >
                      {subscription?.status === 'EXPIRED' ? 'Renouveler' : 'Activer maintenant'}
                    </Link>
                  </div>
                )}
              </AnimatePresence>
              {/* ⭐ 2026-10-01 — Barre de périmètre (national uniquement) :
                  agrégation de tous les départements + lecture seule/délégation */}
              <FederisScopeBar />
              {children}
            </div>
          </main>
        </div>

        {/* Bouton menu mobile — simple et sobre */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed bottom-4 left-4 z-50 lg:hidden p-3 bg-blue-900 text-white rounded-lg shadow-lg"
          aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <AppIcon name={sidebarOpen ? 'close' : 'menu'} size="menu" />
        </button>

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
    </FederisScopeProvider>
  );
}
