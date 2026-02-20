/**
 * ============================================================================
 * PILOTAGE TOP BAR - CONTEXTE & MAÎTRISE
 * ============================================================================
 * 
 * Top Bar qui rappelle TOUJOURS où on se trouve.
 * Aucune action sans contexte.
 * 
 * Philosophie : Montrer avant de demander
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Bell, RefreshCw, User, LogOut, Wifi, WifiOff, AlertCircle, ChevronDown, Settings, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AcademicYearSelector from './AcademicYearSelector';
import SchoolLevelSelector from './SchoolLevelSelector';
import AcademicTrackSelector from '../dashboard/AcademicTrackSelector';
import { useOffline, useSyncStatus } from '@/hooks/useOffline';
import type { User, Tenant } from '@/types';

interface PilotageTopBarProps {
  user: User;
  tenant: Tenant;
}

export default function PilotageTopBar({ user, tenant }: PilotageTopBarProps) {
  const router = useRouter();
  const isOnline = useOffline();
  const { isSyncing, pendingCount } = useSyncStatus();
  const [orionAlertsCount, setOrionAlertsCount] = useState(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Charger les alertes ORION
  useEffect(() => {
    const loadOrionAlerts = async () => {
      try {
        const response = await fetch('/api/orion/alerts?status=active');
        if (response.ok) {
          const alerts = await response.json();
          setOrionAlertsCount(alerts.length || 0);
        }
      } catch (error) {
        console.error('Failed to load ORION alerts:', error);
      }
    };

    loadOrionAlerts();
    const interval = setInterval(loadOrionAlerts, 60000); // Toutes les minutes
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      router.push('/login');
    }
  };

  // Fermer le dropdown si on clique en dehors
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-sm bg-white/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Gauche : Logo + Contexte */}
          <div className="flex items-center space-x-6">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt="Academia Hub"
                  width={36}
                  height={36}
                  className="rounded-lg shadow-sm"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent hidden sm:block">
                Academia Hub
              </span>
            </div>

            {/* Séparateur */}
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />

            {/* Sélecteurs de Contexte */}
            <div className="flex items-center space-x-3">
              <AcademicYearSelector />
              <SchoolLevelSelector />
              <AcademicTrackSelector />
            </div>
          </div>

          {/* Droite : Actions & Profil */}
          <div className="flex items-center space-x-4">
            {/* Indicateur Offline/Online */}
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <div className="flex items-center space-x-2 text-sm">
                  {isSyncing ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="hidden sm:inline text-blue-700 font-medium">Sync...</span>
                    </div>
                  ) : pendingCount > 0 ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Wifi className="w-4 h-4 text-yellow-600" />
                      <span className="hidden sm:inline text-yellow-700 font-medium">{pendingCount} en attente</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                      <Wifi className="w-4 h-4 text-green-600" />
                      <span className="hidden sm:inline text-green-700 font-medium">En ligne</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                  <WifiOff className="w-4 h-4 text-orange-600" />
                  <span className="hidden sm:inline text-orange-700 font-medium">Hors ligne</span>
                </div>
              )}
            </div>

            {/* Alertes ORION */}
            {orionAlertsCount > 0 && (
              <button
                onClick={() => router.push('/app/orion')}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105 active:scale-95 group"
                title="Alertes ORION"
              >
                <Bell className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                {orionAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shadow-md animate-pulse">
                    {orionAlertsCount > 9 ? '9+' : orionAlertsCount}
                  </span>
                )}
              </button>
            )}

            {/* Profil avec Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 group"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-[fadeIn_0.2s_ease-out]">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    <p className="text-xs text-blue-600 font-medium mt-1">{user.role}</p>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        router.push('/app/settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span>Paramètres</span>
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Ajouter page d'aide
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4 text-gray-500" />
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
    </header>
  );
}

