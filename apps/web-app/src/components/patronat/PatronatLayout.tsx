/**
 * PatronatLayout - Layout Application Connectée
 * 
 * Layout institutionnel pour l'application Patronat connectée
 * Utilisé sur toutes les pages /patronat/* (sauf marketing)
 * 
 * Structure :
 * - Header institutionnel fixe
 * - Sidebar navigation fixe
 * - Main content scrollable
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import type { User, Tenant } from '@/types';

interface PatronatLayoutProps {
  children: React.ReactNode;
  user: User;
  patronat: Tenant;
  currentAcademicYear?: {
    id: string;
    label: string;
  };
}

const navigationItems = [
  {
    name: 'Tableau de bord',
    href: '/patronat/dashboard',
    icon: 'dashboard' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR', 'EXAM_VIEWER'],
  },
  {
    name: 'Écoles',
    href: '/patronat/schools',
    icon: 'building' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
  },
  {
    name: 'Examens',
    href: '/patronat/exams',
    icon: 'exams' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
  },
  {
    name: 'Candidats',
    href: '/patronat/candidates',
    icon: 'scolarite' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
  },
  {
    name: 'Centres',
    href: '/patronat/centers',
    icon: 'classes' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
  },
  {
    name: 'Documents',
    href: '/patronat/documents',
    icon: 'document' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
  },
  {
    name: 'Banque d\'épreuves',
    href: '/patronat/question-bank',
    icon: 'document' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
  },
  {
    name: 'Rapports',
    href: '/patronat/reports',
    icon: 'finance' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_VIEWER'],
  },
  {
    name: 'ORION',
    href: '/patronat/orion',
    icon: 'sparkles' as const,
    roles: ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
  },
  {
    name: 'Paramètres',
    href: '/patronat/settings',
    icon: 'settings' as const,
    roles: ['PATRONAT_ADMIN'],
  },
];

export default function PatronatLayout({
  children,
  user,
  patronat,
  currentAcademicYear,
}: PatronatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const userRole = user.role || 'EXAM_VIEWER';
  const filteredNavigation = navigationItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Institutionnel Fixe */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          {/* Logo & Identité */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm - Patronat"
              width={40}
              height={40}
              className="h-10 w-auto"
              priority
              sizes="40px"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-gray-900">
                {patronat.name}
              </div>
              {currentAcademicYear && (
                <div className="text-xs text-gray-500">
                  {currentAcademicYear.label}
                </div>
              )}
            </div>
          </div>

          {/* Actions Header */}
          <div className="flex items-center space-x-4">
            {/* Notifications ORION (si alertes) */}
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Alertes ORION"
            >
              <AppIcon name="bell" size="menu" />
            </button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-gray-500">{userRole}</div>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user.firstName?.[0] || user.email[0].toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar Navigation Fixe */}
        <aside
          className={cn(
            'fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 transition-transform duration-300 z-30',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0'
          )}
        >
          <nav className="h-full overflow-y-auto py-4">
            <div className="px-3 space-y-1">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-900 border-l-2 border-blue-900'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <AppIcon
                    name={item.icon}
                    size="menu"
                    className={cn(
                      isActive(item.href) ? 'text-blue-900' : 'text-gray-500'
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
          )}
        >
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          'fixed bottom-4 left-4 z-50 lg:hidden',
          'p-3 bg-blue-700 text-white rounded-full shadow-lg',
          'hover:bg-blue-800 transition-colors'
        )}
        aria-label="Toggle sidebar"
      >
        <AppIcon name={sidebarOpen ? 'close' : 'menu'} size="menu" />
      </button>
    </div>
  );
}

