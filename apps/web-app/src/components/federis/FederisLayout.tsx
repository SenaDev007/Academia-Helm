/**
 * FederisLayout - Portail Academia Federis
 * 
 * Layout institutionnel pour l'écosystème Academia Federis
 * Utilisé sur toutes les pages /federis/* (espace connecté)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import type { User, Tenant } from '@/types';
import OfflineIndicator from '@/components/offline/OfflineIndicator';
import OfflineGuard from '@/components/offline/OfflineGuard';
import { offlineBootstrapService } from '@/lib/offline/offline-bootstrap.service';
import { useFederisPath } from '@/lib/federis/useFederisPath';

interface FederisLayoutProps {
  children: React.ReactNode;
  user: User;
  federis: Tenant;
  currentAcademicYear?: {
    id: string;
    label: string;
  };
}

// Navigation items use relative sub-paths (e.g. '/dashboard' not '/federis/dashboard')
// The useFederisPath hook prepends the correct base path depending on the domain.
const federisNavItems = [
  {
    category: 'GOUVERNANCE',
    items: [
      { name: 'Tableau de bord', subPath: '/dashboard', icon: 'dashboard' as const },
      { name: 'Bureau & Membres', subPath: '/bureau', icon: 'building' as const },
      { name: 'Réseau d\'Écoles', subPath: '/schools', icon: 'building' as const },
      { name: 'Classes d\'Examen', subPath: '/exam-classes', icon: 'classes' as const },
      { name: 'Federis Connect', subPath: '/connect', icon: 'bell' as const },
    ]
  },
  {
    category: 'EXAMENS',
    items: [
      { name: 'Session d\'Examens', subPath: '/exams', icon: 'exams' as const },
      { name: 'Centres d\'Examen', subPath: '/centers', icon: 'classes' as const },
      { name: 'Candidats', subPath: '/candidates', icon: 'scolarite' as const },
      { name: 'Épreuves & Sujets', subPath: '/question-bank', icon: 'document' as const },
      { name: 'Surveillance', subPath: '/surveillance', icon: 'warning' as const },
    ]
  },
  {
    category: 'DÉROULEMENT',
    items: [
      { name: 'Composition', subPath: '/compositions', icon: 'exams' as const },
      { name: 'Correction', subPath: '/correction', icon: 'document' as const },
      { name: 'Saisie des Notes', subPath: '/grading', icon: 'document' as const },
      { name: 'Délibérations', subPath: '/deliberations', icon: 'dashboard' as const },
      { name: 'Résultats', subPath: '/results', icon: 'bell' as const },
    ]
  },
  {
    category: 'PILOTAGE & FINANCE',
    items: [
      { name: 'Notifications', subPath: '/notifications', icon: 'bell' as const },
      { name: 'Statistiques', subPath: '/stats', icon: 'finance' as const },
      { name: 'Rapports', subPath: '/reports', icon: 'document' as const },
      { name: 'Finances', subPath: '/billing', icon: 'finance' as const },
      { name: 'Archives & Diplômes', subPath: '/archives', icon: 'document' as const },
    ]
  },
  {
    category: 'SYSTÈME',
    items: [
      { name: 'Sarah AI', subPath: '/sara', icon: 'sparkles' as const },
      { name: 'ORION', subPath: '/orion', icon: 'sparkles' as const },
      { name: 'Gestion des Conflits', subPath: '/conflicts', icon: 'warning' as const },
      { name: 'Paramètres', subPath: '/settings', icon: 'settings' as const },
      { name: 'Admin Plateforme', subPath: '/platform-admin', icon: 'settings' as const },
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

  const userRole = user.role || 'FEDERIS_VIEWER';

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <OfflineGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3 flex-shrink-0">
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Federis"
                width={40}
                height={40}
                className="h-10 w-auto"
                priority
              />
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-blue-900">FEDERIS</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  {federis.name}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="hidden md:flex flex-col items-end mr-4 border-r border-gray-100 pr-6">
                 <div className="flex items-center space-x-2 mb-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Année Scolaire</span>
                   <select className="bg-gray-50 border border-gray-200 text-xs font-black text-blue-900 rounded-md px-2 py-1 outline-none">
                     <option value="2026-2027">2026 - 2027 (Active)</option>
                   </select>
                 </div>
                 <div className="flex items-center space-x-2">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Période/Session</span>
                   <select className="bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-md px-2 py-0.5 outline-none">
                     <option value="session-annuelle">Session Annuelle Principale</option>
                   </select>
                 </div>
              </div>

              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors relative">
                <AppIcon name="bell" size="menu" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-gray-500">{userRole}</div>
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user.firstName?.[0] || user.email[0].toUpperCase()}
                  </span>
                </div>
                {/* Logout Button (Section 20.2) */}
                <button 
                  onClick={async () => {
                    await offlineBootstrapService.clearCache();
                    window.location.href = '/login';
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Déconnexion sécurisée (Efface le cache offline)"
                >
                  <AppIcon name="logout" size="menu" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex pt-16">
          <aside className={cn(
            'fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 transition-transform duration-300 z-30',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0'
          )}>
            <nav className="h-full overflow-y-auto py-6 scrollbar-hide">
              {federisNavItems.map((group) => (
                <div key={group.category} className="mb-6">
                  <h3 className="px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {group.category}
                  </h3>
                  <div className="px-3 space-y-0.5">
                    {group.items.map((item) => {
                      const itemHref = federisPath(item.subPath);
                      return (
                      <Link
                        key={item.subPath}
                        href={itemHref}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isActive(itemHref)
                            ? 'bg-blue-900 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-blue-900'
                        )}
                      >
                        <AppIcon name={item.icon} size="menu" className={cn(isActive(itemHref) ? 'text-white' : 'text-gray-400')} />
                        <span>{item.name}</span>
                      </Link>
                    );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <main className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-0')}>
            <div className="p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed bottom-4 left-4 z-50 lg:hidden p-3 bg-blue-700 text-white rounded-full shadow-lg hover:bg-blue-800 transition-colors"
        >
          <AppIcon name={sidebarOpen ? 'close' : 'menu'} size="menu" />
        </button>

        <OfflineIndicator />
      </div>
    </OfflineGuard>
  );
}
