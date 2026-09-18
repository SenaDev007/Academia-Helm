/**
 * ============================================================================
 * PILOTAGE TOP BAR - CONTEXTE & MAÎTRISE
 * ============================================================================
 * 
 * Top Bar qui rappelle TOUJOURS où on se trouve.
 * Aucune action sans contexte.
 * 
 * Design V2 : Palette officielle Academia Helm
 *   - Base : white / cloud (#F7F9FC)
 *   - Accent : blue-900 (#0A2A5E) / gold-500 (#F2C94C)
 *   - Séparateur doré subtil en bas
 * 
 * Philosophie : Montrer avant de demander
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Bell, RefreshCw, User as UserIcon, LogOut, Wifi, WifiOff, ChevronDown, Settings, HelpCircle, School, Globe, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
// ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service)
import UserAvatar from '@/components/profile/UserAvatar';
import ProfileDialog from '@/components/profile/ProfileDialog';
import { useUserProfileStore } from '@/stores/user-profile-store';
import AcademicYearSelector from './AcademicYearSelector';
import SchoolLevelSelector from './SchoolLevelSelector';
// ⛔ 2026-09-12 : AcademicTrackSelector RETIRÉ de la topbar — l'utilisateur n'a
// jamais demandé ces boutons « Piste académique / Francophone / Anglophone ».
// La locale UI reste pilotée par I18nContext (scope serveur + LanguageSwitcher) ;
// la piste de DONNÉES reste pilotée par BilingualContext (verrou scope serveur).
// import AcademicTrackSelector from './AcademicTrackSelector';
// ⛔ OFFLINE-FIRST DÉSACTIVÉ — useOffline/useSyncStatus supprimés
// import { useOffline, useSyncStatus } from '@/hooks/useOffline';
import InAppReviewModal from '@/components/reviews/InAppReviewModal';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { DesktopUpdateBadge } from '@/components/header/DesktopUpdateBadge';
// ⭐ Double casquette : bascule instantanée vers l'UI Enseignant sans déconnexion
import PortalSwitchButton from '@/components/auth/PortalSwitchButton';
// ⛔ OFFLINE-FIRST DÉSACTIVÉ — SyncButton supprimé
// import { SyncButton } from '@/components/header/SyncButton';
import type { User, Tenant } from '@/types';
import { cachedGet, invalidateApiCache } from '@/lib/api/get-cache';

// ── Rôles promoteur : seuls à voir le bouton « Vue Groupe » (vue stratégique
//    multi-écoles — miroir des rôles stratégiques du backend /analytics).
const PROMOTER_GROUP_ROLES = ['PROMOTER', 'PROMOTEUR', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'];

interface SchoolIdentity {
  schoolName: string;
  schoolAcronym?: string;
  logoUrl?: string;
}

interface PilotageTopBarProps {
  user: User;
  tenant: Tenant;
  onMenuClick?: () => void;
  mobileDrawerOpen?: boolean;
}

const SCHOOL_IDENTITY_UPDATED_EVENT = 'settings-school-identity-updated';

/**
 * Construit l'URL de la landing page (domaine principal sans sous-domaine).
 * Priorité : NEXT_PUBLIC_LANDING_URL > déduction automatique.
 */
function getLandingPageUrl(): string {
  if (typeof window === 'undefined') return '/';
  try {
    // Priorité 1 : Variable d'environnement explicite (URL du site public)
    const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL;
    if (landingUrl) {
      const clean = landingUrl.replace(/\/+$/, '');
      return clean;
    }
    // Priorité 2 : Déduction automatique
    const { hostname, protocol, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    }
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      const clean = baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${clean}`;
    }
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const main = parts.slice(1).join('.');
      return port ? `${protocol}//${main}:${port}` : `${protocol}//${main}`;
    }
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
  } catch {
    return '/';
  }
}

/**
 * URL de la landing page avec marqueur ?from_app=true
 * pour que le header public affiche "Retourner à l'application".
 * Inclut aussi l'URL de retour pour que le bouton puisse renvoyer vers l'app.
 */
function getLandingPageUrlFromApp(): string {
  const base = getLandingPageUrl();
  const sep = base.includes('?') ? '&' : '?';
  // Construire l'URL de retour vers l'application courante
  let returnUrl = '';
  if (typeof window !== 'undefined') {
    returnUrl = `${window.location.origin}/app`;
  }
  const returnParam = returnUrl ? `&return_url=${encodeURIComponent(returnUrl)}` : '';
  return `${base}${sep}from_app=true${returnParam}`;
}

function formatRoleLabel(role?: string) {
  if (!role) return '—';

  // ⭐ Mapping complet des rôles plateforme (UserRole enum) + rôles legacy
  //    + rôles niveau-spécifiques (produits par resolveUserRoleWithLevel).
  //    Le header affiche le LIBELLÉ français, pas le code technique.
  const labels: Record<string, string> = {
    // ── Rôles plateforme ──
    PLATFORM_SUPER_ADMIN: 'Super Admin',
    PLATFORM_OWNER: 'Propriétaire plateforme',
    PLATFORM_ADMIN: 'Admin plateforme',
    SUPER_ADMIN: 'Super Admin',

    // ── Rôles école (UserRole enum) ──
    PROMOTER: 'Promoteur',
    PROMOTEUR: 'Promoteur',
    DIRECTEUR: 'Directeur / Directrice',
    SECRETAIRE: 'Secrétaire',
    COMPTABLE: 'Comptable',
    SECRETAIRE_COMPTABLE: 'Secrétaire-Comptable',
    CENSEUR: 'Censeur',
    SURVEILLANT: 'Surveillant',
    ENSEIGNANT: 'Enseignant',

    // ── Rôles école (legacy anglais) ──
    SUPER_DIRECTOR: 'Promoteur',
    DIRECTOR: 'Directeur',
    DIRECTOR_GENERAL: 'Directeur Général',
    SCHOOL_DIRECTOR: 'Directeur',
    DEPUTY_DIRECTOR: 'Directeur Adjoint',
    ADMIN: 'Administrateur',
    SCHOOL_ADMIN: 'Admin École',
    SCHOOL_OWNER: 'Propriétaire École',
    TEACHER: 'Enseignant',
    ACCOUNTANT: 'Comptable',
    CASHIER: 'Caissier',
    CENSOR: 'Censeur',
    GENERAL_MONITOR: 'Surveillant Général',
    SURVEILLANT_GENERAL: 'Surveillant Général',

    // ── Rôles niveau-spécifiques (produits par resolveUserRoleWithLevel) ──
    // Directeurs
    DIRECTEUR_MATERNELLE: 'Directeur Maternelle',
    DIRECTEUR_PRIMAIRE: 'Directeur Primaire',
    DIRECTEUR_SECONDAIRE: 'Directeur Secondaire',
    DIRECTEUR_MAT_PRI: 'Directeur Maternelle + Primaire',
    DIRECTEUR_MAT: 'Directeur Maternelle',
    DIRECTEUR_PRI: 'Directeur Primaire',
    DIRECTEUR_SEC: 'Directeur Secondaire',
    DIRECTEUR_GENERAL: 'Directeur Général',
    DIRECTEUR_ETABLISSEMENT: 'Directeur Établissement',

    // Secrétaires
    SECRETAIRE_MATERNELLE: 'Secrétaire Maternelle',
    SECRETAIRE_PRIMAIRE: 'Secrétaire Primaire',
    SECRETAIRE_SECONDAIRE: 'Secrétaire Secondaire',
    SECRETAIRE_MAT_PRI: 'Secrétaire Maternelle + Primaire',
    SECRETAIRE_MAT: 'Secrétaire Maternelle',
    SECRETAIRE_PRI: 'Secrétaire Primaire',
    SECRETAIRE_SEC: 'Secrétaire Secondaire',
    SECRETAIRE_GENERAL: 'Secrétaire Général',

    // Secrétaires-Comptables
    SECRETAIRE_COMPTABLE_MATERNELLE: 'Secrétaire-Comptable Maternelle',
    SECRETAIRE_COMPTABLE_PRIMAIRE: 'Secrétaire-Comptable Primaire',
    SECRETAIRE_COMPTABLE_SECONDAIRE: 'Secrétaire-Comptable Secondaire',
    SECRETAIRE_COMPTABLE_MAT_PRI: 'Secrétaire-Comptable Maternelle + Primaire',
    SECRETAIRE_COMPTABLE_MAT: 'Secrétaire-Comptable Maternelle',
    SECRETAIRE_COMPTABLE_PRI: 'Secrétaire-Comptable Primaire',
    SECRETAIRE_COMPTABLE_SEC: 'Secrétaire-Comptable Secondaire',

    // Comptables
    COMPTABLE_MAT: 'Comptable Maternelle',
    COMPTABLE_PRI: 'Comptable Primaire',
    COMPTABLE_SEC: 'Comptable Secondaire',
    COMPTABLE_MAT_PRI: 'Comptable Maternelle + Primaire',

    // Surveillants
    SURVEILLANT_MAT: 'Surveillant Maternelle',
    SURVEILLANT_PRI: 'Surveillant Primaire',
    SURVEILLANT_SEC: 'Surveillant Secondaire',
    SURVEILLANT_GENERAL_MAT: 'Surveillant Général Maternelle',
    SURVEILLANT_GENERAL_PRI: 'Surveillant Général Primaire',
    SURVEILLANT_GENERAL_SEC: 'Surveillant Général Secondaire',

    // Censeurs
    CENSEUR_MAT: 'Censeur Maternelle',
    CENSEUR_PRI: 'Censeur Primaire',
    CENSEUR_SEC: 'Censeur Secondaire',
    CENSEUR_MAT_PRI: 'Censeur Maternelle + Primaire',

    // ── Autres rôles ──
    PARENT: 'Parent',
    ELEVE: 'Élève',
    SCOLARITE: 'Scolarité',
    RESP_SCOLARITE: 'Responsable Scolarité',
    HR_MANAGER: 'Responsable RH',
    PAYROLL_MANAGER: 'Responsable Paie',
    FINANCE_MANAGER: 'Responsable Finances',
    CFO: 'Directeur Financier',
    ECONOME: 'Économe',
    INTENDANT: 'Intendant',
    COMMUNICATION_MANAGER: 'Responsable Communication',
    IT_MANAGER: 'Responsable IT',
    PEDAGOGIC_DIRECTOR: 'Directeur Pédagogique',
    PEDAGOGIC_COORDINATOR: 'Coordinateur Pédagogique',
    BOARD_PRESIDENT: 'Président du Conseil',
  };

  // Si le rôle a un suffixe niveau-spécifique non listé explicitement,
  // on essaie de le déduire en remplaçant les underscores
  if (labels[role]) return labels[role];

  // Fallback : remplacer les underscores par des espaces et capitaliser
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function PilotageTopBar({ user, tenant, onMenuClick, mobileDrawerOpen }: PilotageTopBarProps) {
  const router = useRouter();
  // ⛔ OFFLINE-FIRST DÉSACTIVÉ — toujours online
  const isOnline = true; // useOffline();
  const isPlatformAdmin = tenant?.subdomain === 'admin' || user?.role === 'PLATFORM_SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER';
  // ⛔ OFFLINE-FIRST DÉSACTIVÉ — pas de sync status
  // const { isSyncing, pendingCount } = useSyncStatus();
  const isSyncing = false;
  const pendingCount = 0;
  const [orionAlertsCount, setOrionAlertsCount] = useState(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  // ⭐ « Mon profil » — dialogue photo de profil + mot de passe
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // ⭐ Avatar frais (source API) avec repli sur la session serveur
  const profileAvatarUrl = useUserProfileStore((s) => s.profile?.avatarUrl ?? null);
  const ensureProfileLoaded = useUserProfileStore((s) => s.ensureLoaded);
  useEffect(() => {
    void ensureProfileLoaded();
  }, [ensureProfileLoaded]);
  const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadSchoolIdentity = useCallback(async () => {
    try {
      // ⭐ PERF (chantier GTMetrix — spéc. §7) : AVANT, TopBar ET Sidebar
      //    faisaient chacun leur fetch /api/settings/identity (cache: no-store)
      //    à CHAQUE vue → 2 requêtes identiques concurrentes + re-fetch à
      //    chaque navigation. APRÈS : cachedGet (dédup in-flight + TTL 45 s,
      //    même mécanique que lib/api/get-cache.ts) → 1 requête partagée,
      //    0 requête en re-navigation < 45 s. Invalidation ciblée sur
      //    l'événement SCHOOL_IDENTITY_UPDATED_EVENT (maj des paramètres).
      const data = await cachedGet<any>('/api/settings/identity', async () => {
        const response = await fetch('/api/settings/identity', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`identity ${response.status}`);
        return response.json();
      });
      if (data) {
        setSchoolIdentity({
          schoolName: data.schoolName,
          schoolAcronym: data.schoolAcronym,
          logoUrl: data.logoUrl,
        });
      }
    } catch (error) {
      console.error('[PilotageTopBar] Failed to load school identity:', error);
    }
  }, []);

  useEffect(() => {
    // ⭐ Les admins platform n'ont pas de tenant — skip les appels tenant.
    // Ces appels retournent 401 pour les admins, ce qui déclenchait
    // l'intercepteur axios et donnait l'impression d'une déconnexion.
    if (isPlatformAdmin) return;

    loadSchoolIdentity();
    const onIdentityUpdated = () => {
      // ⭐ PERF : maj des paramètres identité → purge du cache partagé puis reload
      invalidateApiCache('/api/settings/identity');
      void loadSchoolIdentity();
    };
    window.addEventListener(SCHOOL_IDENTITY_UPDATED_EVENT, onIdentityUpdated);

    // ⭐ Re-fetch quand on revient online (sinon le logo reste manquant après une
    //    période offline pendant laquelle le fetch a échoué silencieusement).
    let lastOnline = isOnline;
    const onOnline = () => {
      if (!lastOnline) {
        lastOnline = true;
        void loadSchoolIdentity();
      }
    };
    const onOffline = () => { lastOnline = false; };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener(SCHOOL_IDENTITY_UPDATED_EVENT, onIdentityUpdated);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadSchoolIdentity, isPlatformAdmin]);

  useEffect(() => {
    // ⭐ Les admins platform n'ont pas de tenant — skip les alertes ORION
    // (endpoint tenant-scoped qui retourne 401 pour les admins).
    if (isPlatformAdmin) return;

    const loadOrionAlerts = async () => {
      try {
        // ⭐ PERF (chantier GTMetrix — spéc. §7) : le dashboard charge la même
        //    URL au même moment (OrionAlertsCard) → dédup in-flight via
        //    cachedGet (TTL 30 s) : 1 requête partagée au chargement au lieu
        //    de 2. Le polling 60 s reste actif (intervalle > TTL = fetch réel).
        const alerts = await cachedGet<any[]>('/api/orion/alerts?status=active', async () => {
          const response = await fetch('/api/orion/alerts?status=active');
          if (!response.ok) throw new Error(`orion ${response.status}`);
          return response.json();
        }, { ttl: 30_000 });
        setOrionAlertsCount(Array.isArray(alerts) ? alerts.length : 0);
      } catch (error) {
        console.error('Failed to load ORION alerts:', error);
      }
    };

    loadOrionAlerts();
    const interval = setInterval(loadOrionAlerts, 60000);
    return () => clearInterval(interval);
  }, [isPlatformAdmin]);

  const handleLogout = async () => {
    try {
      // Timeout court (3s) — si le backend ne répond pas, on déconnecte quand même
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      if (isPlatformAdmin) {
        // Back-office admin : utiliser /api/admin-auth/logout + redirect vers /admin-login
        await fetch('/api/admin-auth/logout', {
          method: 'POST',
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(timeoutId);
        window.location.href = '/admin-login';
      } else {
        // App école : utiliser /api/auth/logout + redirect vers /
        await fetch('/api/auth/logout', {
          method: 'POST',
          signal: controller.signal,
        }).catch(() => {});
        clearTimeout(timeoutId);
        clearClientSessionSync();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error logging out:', error);
      if (isPlatformAdmin) {
        window.location.href = '/admin-login';
      } else {
        clearClientSessionSync();
        window.location.href = '/';
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-50">
      {/* Gold accent line at very top */}
      <div className="h-[2px] bg-gradient-to-r from-blue-900 via-gold-500 to-blue-900" />
      
      <div className="px-4 py-2.5 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          {/* Gauche : Hamburger mobile + Logo École + Contexte */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0 flex-1">
            {/* Hamburger / Close */}
            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="md:hidden p-2 rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 text-gray-600 transition-colors"
                aria-label={mobileDrawerOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              >
                {mobileDrawerOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
            {/* Logo et Nom de l'École (ou Academia Helm pour le back-office admin) */}
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <div className="relative">
                {schoolIdentity?.logoUrl ? (
                  <Image
                    src={schoolIdentity.logoUrl}
                    alt={schoolIdentity.schoolName || 'École'}
                    width={38}
                    height={38}
                    className="rounded-xl shadow-sm object-cover ring-1 ring-gray-100"
                  />
                ) : tenant?.subdomain === 'admin' || user?.role === 'PLATFORM_SUPER_ADMIN' ? (
                  // Back-office admin : utiliser le logo Academia Helm
                  <Image
                    src="/images/logo-Academia Hub.webp"
                    alt="Academia Helm"
                    width={38}
                    height={38}
                    className="rounded-xl shadow-sm object-contain ring-1 ring-gray-100 bg-white"
                  />
                ) : (
                  <div className="w-[38px] h-[38px] bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center shadow-sm">
                    <School className="w-[18px] h-[18px] text-gold-400" />
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div className="hidden sm:block min-w-0">
                <span className="text-[13px] font-bold text-blue-900 block max-w-[240px] leading-tight break-words whitespace-normal line-clamp-1" title={schoolIdentity?.schoolAcronym || schoolIdentity?.schoolName || tenant.name}>
                  {tenant?.subdomain === 'admin' || user?.role === 'PLATFORM_SUPER_ADMIN'
                    ? 'Academia Helm — Back-office'
                    : (schoolIdentity?.schoolAcronym || schoolIdentity?.schoolName || tenant.name || 'Mon École')}
                </span>
              </div>
            </div>

            {/* Séparateur */}
            <div className="h-7 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent hidden sm:block" />

            {/* Sélecteurs de Contexte — masqués sur le back-office admin */}
            {!isPlatformAdmin && (
            <div className="hidden sm:flex items-center space-x-2 md:space-x-3">
              <AcademicYearSelector />
              <SchoolLevelSelector />
              {/* ⛔ AcademicTrackSelector retiré (2026-09-12) — boutons jamais demandés,
                  apparition conditionnelle parasite via feature flag BILINGUAL_TRACK */}
            </div>
            )}
          </div>

          {/* Droite : Actions & Profil */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Indicateur Offline/Online — minimaliste (point coloré) */}
            <div
              className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500' : 'bg-orange-400'
              }`}
              title={isOnline ? 'En ligne' : 'Hors ligne — sync en attente'}
              aria-label={isOnline ? 'En ligne' : 'Hors ligne'}
            />

            {/* Badge "X en attente" — affiché uniquement quand il y a des écritures en attente */}
            {isOnline && isSyncing && (
              <div className="flex items-center space-x-1.5 px-2 py-1 bg-blue-50 rounded-lg border border-blue-100 shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                <span className="text-[11px] text-blue-700 font-medium">Sync…</span>
              </div>
            )}
            {isOnline && !isSyncing && pendingCount > 0 && (
              <div className="flex items-center space-x-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100 shrink-0">
                <Wifi className="w-3 h-3 text-amber-600" />
                <span className="text-[11px] text-amber-700 font-medium">{pendingCount}</span>
              </div>
            )}
            {!isOnline && (
              <div className="flex items-center space-x-1.5 px-2 py-1 bg-orange-50 rounded-lg border border-orange-100 shrink-0">
                <WifiOff className="w-3 h-3 text-orange-600" />
                <span className="text-[11px] text-orange-700 font-medium">Hors ligne</span>
              </div>
            )}

            {/* Notifications in-app (cloche avec dropdown) — admissions, candidatures, etc. */}
            <NotificationDropdown />

            {/* ── Bouton "Télécharger l'app desktop" — visible UNIQUEMENT par le PROMOTER ── */}
            <DesktopUpdateBadge userRole={user.role} />

            {/* ⛔ OFFLINE-FIRST DÉSACTIVÉ — SyncButton supprimé */}
            {/* <SyncButton /> */}

            {/* Alertes ORION — ⭐ ouvre le dropdown de notifications au lieu de rediriger */}
            {orionAlertsCount > 0 && (
              <button
                onClick={() => {
                  // ⭐ Déclencher l'ouverture du NotificationDropdown via un event custom
                  window.dispatchEvent(new CustomEvent('open-notifications'));
                }}
                className="relative p-2 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:scale-105 active:scale-95 group"
                title="Alertes ORION — cliquez pour voir les notifications"
              >
                <Bell className="w-[18px] h-[18px] text-gray-500 group-hover:text-blue-900 transition-colors" />
                <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold shadow-sm animate-pulse leading-none" style={{ minWidth: '18px', height: '18px' }}>
                  {orionAlertsCount > 9 ? '9+' : orionAlertsCount}
                </span>
              </button>
            )}

            {/* Bouton Donner mon avis — masqué sur le back-office admin */}
            {!isPlatformAdmin && (
            <button
              onClick={() => setReviewModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 border"
              style={{
                background: 'linear-gradient(135deg, #FFF8E1, #FFFDF5)',
                borderColor: '#C9A84C',
                color: '#1E3A5F',
              }}
              title="Donner mon avis"
            >
              <Star className="w-3.5 h-3.5" fill="#C9A84C" stroke="#C9A84C" />
              <span>Avis</span>
            </button>
            )}

            {/* ── Vue Groupe — visible UNIQUEMENT pour les rôles promoteur ──
                Vue stratégique multi-écoles : KPIs consolidés du groupe + bascule
                entre établissements (chaîne select-tenant existante). */}
            {PROMOTER_GROUP_ROLES.includes(user.role) && (
              <button
                onClick={() => {
                  window.location.href = '/promoteur';
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                title="Vue stratégique du groupe — tous vos établissements"
              >
                <School className="w-3.5 h-3.5" />
                <span>Vue Groupe</span>
              </button>
            )}

            {/* Profil avec Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2.5 pl-2 pr-1.5 py-1.5 rounded-xl hover:bg-gray-50 transition-all duration-200 group"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-[13px] font-semibold text-gray-900 leading-tight">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium">{formatRoleLabel(user.role)}</p>
                </div>
                <div className="relative">
                  <UserAvatar
                    photoUrl={profileAvatarUrl || (user as { avatarUrl?: string })?.avatarUrl || undefined}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    email={user.email}
                    size={36}
                    className="rounded-xl shadow-sm group-hover:shadow-md transition-shadow ring-1 ring-blue-700/20"
                    initialsClassName="bg-gradient-to-br from-blue-800 to-blue-900"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-[fadeIn_0.15s_ease-out] overflow-hidden">
                  {/* Profile header with gradient */}
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-900 to-blue-800">
                    <p className="text-sm font-semibold text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-blue-200/70 mt-0.5">{user.email}</p>
                    <div className="mt-2 inline-flex items-center space-x-1.5 px-2 py-0.5 bg-white/10 rounded-md">
                      <span className="text-[11px] text-gold-400 font-medium">{formatRoleLabel(user.role)}</span>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    {/* ⭐ « Mon profil » — photo de profil + changement de mot de passe */}
                    <button
                      onClick={() => {
                        setProfileDialogOpen(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-blue-800" />
                      <span>Mon profil</span>
                    </button>
                    {!isPlatformAdmin && (
                    <button
                      onClick={() => {
                        setReviewModalOpen(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors sm:hidden"
                    >
                      <Star className="w-4 h-4 text-amber-500" fill="#C9A84C" />
                      <span>Donner mon avis</span>
                    </button>
                    )}
                    <button
                      onClick={() => {
                        router.push('/app/settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span>Paramètres</span>
                    </button>
                    <a
                      href={getLandingPageUrlFromApp()}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span>Visiter le site</span>
                    </a>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                      <span>Aide & Support</span>
                    </button>
                  </div>

                  <div className="border-t border-gray-100 py-1">
                    {/* ⭐ Double casquette : bascule vers l'UI Enseignant —
                        visible seulement si profil Teacher actif rattaché. */}
                    <PortalSwitchButton
                      target="TEACHER"
                      variant="dropdown"
                      tenantSlugFallback={tenant?.slug}
                    />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom border with subtle gold accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* Review Modal */}
      <InAppReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        authorName={`${user.firstName} ${user.lastName}`}
        authorRole={formatRoleLabel(user.role)}
        schoolName={schoolIdentity?.schoolName || tenant.name || ''}
        city=""
        tenantId={tenant.id}
      />

      {/* ⭐ « Mon profil » — photo de profil + changement de mot de passe (self-service) */}
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        fallbackUser={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: formatRoleLabel(user.role),
        }}
      />
    </header>
  );
}
