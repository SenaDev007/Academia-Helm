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
import { Bell, RefreshCw, User as UserIcon, LogOut, Wifi, WifiOff, ChevronDown, Settings, HelpCircle, School, Globe, Compass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
import AcademicYearSelector from './AcademicYearSelector';
import SchoolLevelSelector from './SchoolLevelSelector';
import AcademicTrackSelector from '../dashboard/AcademicTrackSelector';
import { useOffline, useSyncStatus } from '@/hooks/useOffline';
import type { User, Tenant } from '@/types';

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
 */
function getLandingPageUrl(): string {
  if (typeof window === 'undefined') return '/';
  try {
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
  const labels: Record<string, string> = {
    PLATFORM_OWNER: 'Propriétaire plateforme',
    SUPER_DIRECTOR: 'Promoteur',
    DIRECTOR: 'Directeur',
    ADMIN: 'Administrateur',
    TEACHER: 'Enseignant',
    ACCOUNTANT: 'Comptable',
  };
  return labels[role] ?? role;
}

export default function PilotageTopBar({ user, tenant, onMenuClick, mobileDrawerOpen }: PilotageTopBarProps) {
  const router = useRouter();
  const isOnline = useOffline();
  const { isSyncing, pendingCount } = useSyncStatus();
  const [orionAlertsCount, setOrionAlertsCount] = useState(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadSchoolIdentity = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/identity', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSchoolIdentity({
            schoolName: data.schoolName,
            schoolAcronym: data.schoolAcronym,
            logoUrl: data.logoUrl,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load school identity:', error);
    }
  }, []);

  useEffect(() => {
    loadSchoolIdentity();
    const onIdentityUpdated = () => {
      void loadSchoolIdentity();
    };
    window.addEventListener(SCHOOL_IDENTITY_UPDATED_EVENT, onIdentityUpdated);
    return () => {
      window.removeEventListener(SCHOOL_IDENTITY_UPDATED_EVENT, onIdentityUpdated);
    };
  }, [loadSchoolIdentity]);

  useEffect(() => {
    const loadOrionAlerts = async () => {
      try {
        const response = await fetch('/api/orion/alerts?status=active');
        if (response.ok) {
          const alerts = await response.json();
          setOrionAlertsCount(Array.isArray(alerts) ? alerts.length : 0);
        }
      } catch (error) {
        console.error('Failed to load ORION alerts:', error);
      }
    };

    loadOrionAlerts();
    const interval = setInterval(loadOrionAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearClientSessionSync();
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
      clearClientSessionSync();
      window.location.href = '/';
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
            {/* Logo et Nom de l'École */}
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
                ) : (
                  <div className="w-[38px] h-[38px] bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center shadow-sm">
                    <School className="w-[18px] h-[18px] text-gold-400" />
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div className="hidden sm:block min-w-0">
                <span className="text-[13px] font-bold text-blue-900 block max-w-[240px] leading-tight break-words whitespace-normal line-clamp-1" title={schoolIdentity?.schoolName || tenant.name}>
                  {schoolIdentity?.schoolAcronym || schoolIdentity?.schoolName || tenant.name || 'Mon École'}
                </span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wide">Academia <span className="text-gold-600">Helm</span></span>
              </div>
            </div>

            {/* Séparateur */}
            <div className="h-7 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent hidden sm:block" />

            {/* Sélecteurs de Contexte */}
            <div className="hidden sm:flex items-center space-x-2 md:space-x-3">
              <AcademicYearSelector />
              <SchoolLevelSelector />
              <AcademicTrackSelector />
            </div>
          </div>

          {/* Droite : Actions & Profil */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Indicateur Offline/Online */}
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <div className="flex items-center space-x-1.5 text-xs">
                  {isSyncing ? (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span className="hidden sm:inline text-blue-700 font-medium">Sync...</span>
                    </div>
                  ) : pendingCount > 0 ? (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                      <Wifi className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline text-amber-700 font-medium">{pendingCount} en attente</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline text-emerald-700 font-medium">En ligne</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
                  <WifiOff className="w-3.5 h-3.5 text-orange-600" />
                  <span className="hidden sm:inline text-orange-700 font-medium">Hors ligne</span>
                </div>
              )}
            </div>

            {/* Alertes ORION */}
            {orionAlertsCount > 0 && (
              <button
                onClick={() => router.push('/app/orion')}
                className="relative p-2 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:scale-105 active:scale-95 group"
                title="Alertes ORION"
              >
                <Bell className="w-[18px] h-[18px] text-gray-500 group-hover:text-blue-900 transition-colors" />
                <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold shadow-sm animate-pulse leading-none" style={{ minWidth: '18px', height: '18px' }}>
                  {orionAlertsCount > 9 ? '9+' : orionAlertsCount}
                </span>
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
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow ring-1 ring-blue-700/20">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
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
                      <Compass className="w-3 h-3 text-gold-400" />
                      <span className="text-[11px] text-gold-400 font-medium">{formatRoleLabel(user.role)}</span>
                    </div>
                  </div>
                  
                  <div className="py-1">
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
    </header>
  );
}
